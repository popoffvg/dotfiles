# Modern Go Guidelines (JetBrains)

**Before writing any Go code**, detect the project's Go version from `go.mod`. Use ALL features up to that version. Never use features from newer versions. Never use outdated patterns when a modern alternative exists.

## Go 1.0+
- `time.Since(start)` not `time.Now().Sub(start)`

## Go 1.8+
- `time.Until(deadline)` not `deadline.Sub(time.Now())`

## Go 1.13+
- `errors.Is(err, target)` not `err == target`

## Go 1.18+
- `any` not `interface{}`
- `strings.Cut` / `bytes.Cut` instead of Index+slice

## Go 1.19+
- `fmt.Appendf(buf, ...)` not `[]byte(fmt.Sprintf(...))`
- `atomic.Bool` / `atomic.Int64` / `atomic.Pointer[T]` not `atomic.StoreInt32`

## Go 1.20+
- `strings.Clone(s)` / `bytes.Clone(b)` for memory-safe copies
- `strings.CutPrefix` / `strings.CutSuffix`
- `errors.Join(err1, err2)` to combine errors
- `context.WithCancelCause` + `context.Cause`

## Go 1.21+

**Built-ins:**
- `min` / `max` — not if/else comparisons
- `clear(m)` / `clear(s)` — delete all map entries or zero slice elements

**slices package:**
- `slices.Contains`, `slices.Index`, `slices.IndexFunc`
- `slices.SortFunc(items, func(a, b T) int { return cmp.Compare(a.X, b.X) })`
- `slices.Sort`, `slices.Max`, `slices.Min`, `slices.Reverse`
- `slices.Compact`, `slices.Clip`, `slices.Clone`

**maps package:**
- `maps.Clone`, `maps.Copy`, `maps.DeleteFunc`

**sync package:**
- `sync.OnceFunc(func() { ... })` not `sync.Once` + wrapper
- `sync.OnceValue(func() T { ... })` for cached computation

**context package:**
- `context.AfterFunc(ctx, cleanup)`
- `context.WithTimeoutCause` / `context.WithDeadlineCause`

## Go 1.22+

**Loops:**
- `for i := range n` not `for i := 0; i < n; i++`
- Loop vars are safe to capture in goroutines (each iteration gets own copy)

**cmp package:**
- `cmp.Or(flag, env, config, "default")` — first non-zero value

```go
// Instead of: if name == "" { name = "default" }
name := cmp.Or(os.Getenv("NAME"), "default")
```

**reflect:** `reflect.TypeFor[T]()` not `reflect.TypeOf((*T)(nil)).Elem()`

**net/http:** Enhanced `http.ServeMux` — `mux.HandleFunc("GET /api/{id}", handler)` + `r.PathValue("id")`

## Go 1.23+
- `maps.Keys(m)` / `maps.Values(m)` return iterators
- `slices.Collect(iter)` to build slice from iterator
- `slices.Sorted(iter)` to collect and sort
- `time.Tick` is safe — GC recovers unreferenced tickers since 1.23

```go
keys := slices.Collect(maps.Keys(m))
sortedKeys := slices.Sorted(maps.Keys(m))
```

## Go 1.24+
- `t.Context()` not `context.WithCancel(context.Background())` in tests
- `omitzero` not `omitempty` in JSON tags for `time.Duration`, `time.Time`, structs, slices, maps
- `b.Loop()` not `for i := 0; i < b.N; i++` in benchmarks
- `strings.SplitSeq` / `strings.FieldsSeq` / `bytes.SplitSeq` when iterating split results in for-range

```go
for part := range strings.SplitSeq(s, ",") { process(part) }
```

## Go 1.25+
- `wg.Go(fn)` not `wg.Add(1)` + `go func() { defer wg.Done(); ... }()`

```go
var wg sync.WaitGroup
for _, item := range items {
    wg.Go(func() { process(item) })
}
wg.Wait()
```

## Go 1.26+
- `new(val)` not `x := val; &x` — returns pointer to any value. Type inferred: `new(0)` → `*int`
- `errors.AsType[T](err)` not `errors.As(err, &target)`

```go
cfg := Config{ Timeout: new(30), Debug: new(true) }

if pathErr, ok := errors.AsType[*os.PathError](err); ok { handle(pathErr) }
```
