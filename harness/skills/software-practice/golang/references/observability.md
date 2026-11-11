# OpenTelemetry

Every service exports traces and metrics over OTLP. The HTTP server and the database layer are instrumented by contrib packages; hand-written spans cover only expensive work inside the process.

## Packages

| Layer | Package | Gives |
| --- | --- | --- |
| SDK setup | `go.opentelemetry.io/otel/sdk`, `go.opentelemetry.io/contrib/exporters/autoexport` | Exporter chosen by `OTEL_*` env vars; `none` when unset |
| HTTP server | `go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp` | Server span per request, `http.server.request.duration`, W3C context from headers |
| HTTP client | `otelhttp.NewTransport` | Client span, context injected into outgoing headers |
| PostgreSQL (pgx) | `github.com/exaring/otelpgx` | Span per query, pool metrics |
| PostgreSQL (`database/sql`) | `github.com/XSAM/otelsql` | Same, for `database/sql` drivers |
| Logs | trace ids on slog records | `trace_id` and `span_id` on every request log line |

## Setup

```go
// setupOTel returns the shutdown function. main MUST call it before exit, or the last spans are lost.
func setupOTel(ctx context.Context, version string) (func(context.Context) error, error) {
	res, err := resource.New(ctx,
		resource.WithFromEnv(),
		resource.WithAttributes(semconv.ServiceVersion(version)),
	)
	if err != nil {
		return nil, fmt.Errorf("otel: resource: %w", err)
	}
	spans, err := autoexport.NewSpanExporter(ctx)
	if err != nil {
		return nil, fmt.Errorf("otel: span exporter: %w", err)
	}
	metrics, err := autoexport.NewMetricReader(ctx)
	if err != nil {
		return nil, fmt.Errorf("otel: metric reader: %w", err)
	}
	tp := sdktrace.NewTracerProvider(sdktrace.WithBatcher(spans), sdktrace.WithResource(res))
	mp := sdkmetric.NewMeterProvider(sdkmetric.WithReader(metrics), sdkmetric.WithResource(res))
	otel.SetTracerProvider(tp)
	otel.SetMeterProvider(mp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{}, propagation.Baggage{},
	))
	return func(ctx context.Context) error {
		return errors.Join(tp.Shutdown(ctx), mp.Shutdown(ctx))
	}, nil
}
```

- Configuration MUST come from the standard env vars only: `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_TRACES_EXPORTER`, `OTEL_TRACES_SAMPLER`. No custom flag repeats one of them.
- With no endpoint set, `autoexport` falls back to OTLP on localhost. Set `OTEL_TRACES_EXPORTER=none` and `OTEL_METRICS_EXPORTER=none` in tests and local runs that have no collector.

## HTTP server

```text
otelhttp.NewHandler   server span, duration metric, reads traceparent
└─ logRequests        request log line with trace_id and span_id
   └─ ServeMux
      └─ withRoute    names the span and sets http.route from the route row
         └─ requireAuth → handler
```

```go
// In NewServer:
Handler: otelhttp.NewHandler(logRequests(log, mux), "http.server"),

// In the route-table loop, after requireAuth:
h = withRoute(r, h)

func withRoute(r route, next http.Handler) http.Handler {
	name := r.method + " " + r.path
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		trace.SpanFromContext(req.Context()).SetName(name)
		trace.SpanFromContext(req.Context()).SetAttributes(semconv.HTTPRoute(r.path))
		if l, ok := otelhttp.LabelerFromContext(req.Context()); ok {
			l.Add(semconv.HTTPRoute(r.path))
		}
		next.ServeHTTP(w, req)
	})
}
```

- The span name and `http.route` MUST be the route pattern (`POST /api/v1/users`), never `r.URL.Path`. A raw path with an id in it gives one metric series per id.
- `otelhttp` MUST be outermost, so the logger and every handler see the span in the context.
- `logRequests` adds the ids to the request logger:

```go
sc := trace.SpanContextFromContext(r.Context())
reqLog := log.With(
	slog.String("request_id", id),
	slog.String("trace_id", sc.TraceID().String()),
	slog.String("span_id", sc.SpanID().String()),
)
```

## Database layer

```go
func Open(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("postgres: parse config: %w", err)
	}
	cfg.ConnConfig.Tracer = otelpgx.NewTracer(otelpgx.WithSpanNameFunc(sqlcQueryName))
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("postgres: open pool: %w", err)
	}
	if err := otelpgx.RecordStats(pool); err != nil {
		return nil, fmt.Errorf("postgres: pool metrics: %w", err)
	}
	return pool, nil
}

// sqlcQueryName reads the "-- name: X :kind" line that sqlc keeps at the top of each query.
func sqlcQueryName(stmt string) string {
	line, _, _ := strings.Cut(stmt, "\n")
	if name, ok := strings.CutPrefix(line, "-- name: "); ok {
		name, _, _ = strings.Cut(name, " ")
		return "db " + name
	}
	return "db query"
}
```

- A DB span MUST NOT carry query parameters. Never pass `otelpgx.WithIncludeQueryParameters()`: the parameters hold password hashes and personal data.
- The span name is the sqlc query name, not the SQL text, so one query is one name in the trace view.
- Every repository method MUST take the request `ctx` and pass it to the query. A query run with `context.Background()` starts a new trace and loses its parent.

## Spans in the domain

```go
var tracer = otel.Tracer("github.com/popoffvg/miniauth/internal/users")

func HashPassword(ctx context.Context, p Password) (PasswordHash, error) {
	ctx, span := tracer.Start(ctx, "users.HashPassword")
	defer span.End()
	// ...
}
```

- Add a span only around work that costs time inside the process and has no span yet: a password hash, a large parse, a call batch. HTTP and DB calls are already traced.
- A domain package MAY import the OTel API (`go.opentelemetry.io/otel`, `.../trace`). It MUST NOT import the SDK or an exporter; only `main` does.
- Set `span.SetStatus(codes.Error, ...)` and `span.RecordError(err)` only for a failure of the service. An expected domain result (409 login taken, 401 wrong token) is not a span error.

## Secrets

- A span or a metric MUST NOT carry a header value, a body, a token, a password, a hash, or a query parameter. `otelhttp` records none of them by default; do not add them.
- A login or an email is personal data: do not put it in an attribute. Put the user id instead.

## Test

```go
func newTestTracer(t *testing.T) *tracetest.SpanRecorder {
	t.Helper()
	sr := tracetest.NewSpanRecorder()
	tp := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(sr))
	prev := otel.GetTracerProvider()
	otel.SetTracerProvider(tp)
	t.Cleanup(func() { otel.SetTracerProvider(prev) })
	return sr
}
```

Assert on `sr.Ended()`: the server span is named after the route pattern, the DB span after the sqlc query, and no attribute value contains the test password or token. A test that sets the global provider MUST NOT call `t.Parallel`.
