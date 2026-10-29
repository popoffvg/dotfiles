---
name: golang
description: Rules for Go code under domain-driven design — every entity, value object, id, and DTO is its own named type. Use when writing, sketching, or reviewing Go code, a Go function signature, a struct, or Go pseudocode in a design draft. Also use when writing a Go HTTP server, auth or logging middleware, an OpenAPI spec for Go code, or a Go test of any layer (unit, DB, API, E2E), or adding OpenTelemetry traces or metrics to Go code.
user-invocable: false
---

# Go under domain-driven design

## One concept, one type

A domain concept MUST have its own named type. A value is a domain concept when the glossary names it or it carries an invariant: a format, a range, a secret. A bare `string`, `[]byte`, `int`, `uuid.UUID`, or `time.Time` MUST NOT carry a domain concept in a signature, a struct field, or across a package boundary.

```go
func Submit(ctx context.Context, flowID []byte, ev FlowEvent) error // wrong
func Submit(ctx context.Context, id loginflows.ID, ev FlowEvent) error // right
```

## Package names

A domain package that holds an entity MUST be named in the plural: `users`, not `user`; `loginflows`, not `loginflow`. The singular is the entity type, so a variable of that type keeps the plain name: `user := users.User{}`, not a clash with the package.

Inside the package, a name MUST NOT repeat the entity the package already names: `users.ID`, `users.Login`, `users.Repository`, `users.Service`; not `users.UserID` or `users.UserRepository`. The entity type itself (`users.User`) is the one exception.

## Kinds of type

| Kind | Shape | Rule |
| --- | --- | --- |
| Id | `type ID uuid.UUID` in package `users`, `type ID [32]byte` in package `loginflows` | One id type per entity. Never convert one id type into another. |
| Value object | Small immutable type | Built only by `NewX`, which validates and returns `(X, error)`, or read through `UnmarshalText` when it has a text form ([references/encoding.md](references/encoding.md)). Methods return a new value. |
| Entity | Struct with an id field of its own id type | Changes state only through methods that keep its invariants. Fields that an invariant guards are unexported. |
| DTO | Struct in an adapter package: HTTP body, sqlc row, message | Maps to and from the domain in one function per direction. A DTO MUST NOT enter the domain package. |
| Repository | Interface in the domain package, one per aggregate: `type Repository interface { Lock(ctx, ID) (LoginFlow, error); Save(ctx, LoginFlow) error }` in package `loginflows` | Takes and returns entities, never DTOs. The adapter implements it. |

## Details

- Prefer a comparable underlying type, an array instead of a slice, so `==` and map keys work.
- Domain errors live in the domain package (`ErrFlowNotFound`). The adapter maps a driver error such as `pgx.ErrNoRows` to it. A driver error MUST NOT reach the domain.
- A secret type implements `String`, `Format`, and `slog.LogValuer` to print `redacted`.
- The domain package MUST NOT import an adapter package. The adapter imports the domain.

## Public surface

- A symbol is public only when a caller outside its package calls it, a design names a planned caller for it, or it implements an interface that such a caller uses. A test is not a caller. Code kept for a feature that no design plans stays private.
- A package exposes its caller's operation, not the steps: when a caller must call several methods in a fixed order to keep one invariant (take the lease, write, release), make the sequence one public method and the steps private.
- A helper that only its package calls MUST be private: a key builder, a check, a format helper. Make it public only when code outside the package calls it.
- A mechanism a caller must not drive by hand MUST be a private type, owned by the one public type that needs it. Example: the store takes, renews, checks, and releases its own lease, and no write takes a `*Lease` argument. Only the errors a caller matches on stay public.
- When a value already carries its kind (an id with a `G` or `S` prefix), write one function for every kind, not one function per kind plus a check that refuses the wrong kind.
- A function that cannot fail MUST NOT return an `error`. Example: a `crypto/rand` read does not fail on Go 1.24 and later.
- A package under `util/` declares the small interface it needs. It does not import a `platform/` or `controllers/` package for one interface.

## Control flow

- Keep the main path at the left margin. Return early on each error or refusal. MUST NOT nest an `if` inside an `if` or a `switch` case, and MUST NOT write `else` after a branch that returns.
- When a function makes several checks before its main work, move the checks into a helper that returns the value the main work needs, or the error. Example: `leaseVersionToTake` returns the version a take overwrites, so `takeLease` reads as: get the version, write, confirm.
- When two conditions give several outcomes, name each condition as a `bool` and write each outcome as one case of a flat `switch`: `case holdsNoData && !stale`, `case holdsNoData`, `case !current.isFree(now)`.
- When the choice of which error to return needs more than two branches, move it into a pure function of the errors: `takeFailure(writeErr, confirmErr error) error`.
- Caution: a flattened branch MUST still return before the next check. A case that returned early and now falls through merges into the next case and changes the result. Run the test of each case after the change.

## Concurrency

- A one-time event (work done, lease lost, stopped) MUST be a `chan struct{}` that its owner closes once; wrap the close in `sync.OnceFunc` when two paths can close it. Readers `select` on it. MUST NOT model the event as a `bool` that another goroutine reads under a mutex.
- When a goroutine must stop on either the caller's `ctx` or the work's own done channel, merge the two into one channel with a helper (in `pl`: `michan.CloseBy(ctx.Done(), workDone)`). MUST NOT replace a done channel that other code reads as an event with `context.WithCancel`.
- A second operation on a value that runs one operation at a time MUST wait for the first, not fail fast on a busy flag. Wait with a token channel `make(chan struct{}, 1)`: send in a `select` with `ctx.Done()` to enter, receive in a `defer` to leave. A wait on `sync.Mutex` cannot end with `ctx`, and under `testing/synctest` it does not count as durably blocked, so the fake clock stops.
- A check-then-write MUST read the state once, under the lock or lease that guards the write. MUST NOT add a lock-free pre-read to skip the lock: the state can change before the lock, so the read under the lock is needed anyway, and the pre-read adds a second path to test.

## Errors

A check that several callers share returns an error that names no flag, file, or caller. Each caller wraps it with its own context: `fmt.Errorf("--metadata-storage-s3: %w", err)`. Do not add a parameter that only puts the caller's name into the message.

## SDK input structs

Before you change the fields of an SDK input struct that the caller passed in, make a deep copy with the SDK's copy function or a `Clone` method. `c := *params` shares the pointer fields, so a change through `c` changes the caller's value.

## References

- Text, YAML, and JSON forms MUST follow [references/encoding.md](references/encoding.md): the text interfaces instead of `ParseX`, no `Encode`/`Decode` wrappers, yaml tags with `gopkg.in/yaml.v3`, `validate()` inside the unmarshal method, and `IsZero` for `omitempty`.

- An HTTP server MUST follow [references/http-server.md](references/http-server.md): one route table drives the standard `ServeMux`, the auth wrapping, and the OpenAPI spec that `swaggest/openapi-go` generates from the request and response types; a slog middleware logs each request.
- A test MUST follow [references/testing.md](references/testing.md): testify and gofakeit for unit tests, testfixtures on a Postgres testcontainer for the DB, `httptest` through the real router for the API, Hurl against the shipped image for E2E.
- An HTTP server and a database layer MUST follow [references/observability.md](references/observability.md): OpenTelemetry set up from the `OTEL_*` env vars, `otelhttp` outermost with the span named after the route row, `otelpgx` with spans named after the sqlc query, and no secret or personal data in any span.
