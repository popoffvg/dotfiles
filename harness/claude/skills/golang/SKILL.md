---
name: golang
description: Rules for Go code under domain-driven design — every entity, value object, id, and DTO is its own named type. Use when writing, sketching, or reviewing Go code, a Go function signature, a struct, or Go pseudocode in a design draft. Also use when writing a Go HTTP server, auth or logging middleware, an OpenAPI spec for Go code, or a Go test of any layer (unit, DB, API, E2E).
user-invocable: false
---

# Go under domain-driven design

## One concept, one type

A domain concept MUST have its own named type. A value is a domain concept when the glossary names it or it carries an invariant: a format, a range, a secret. A bare `string`, `[]byte`, `int`, `uuid.UUID`, or `time.Time` MUST NOT carry a domain concept in a signature, a struct field, or across a package boundary.

```go
func Submit(ctx context.Context, flowID []byte, ev FlowEvent) error // wrong
func Submit(ctx context.Context, id FlowID, ev FlowEvent) error     // right
```

## Kinds of type

| Kind | Shape | Rule |
| --- | --- | --- |
| Id | `type UserID uuid.UUID`, `type FlowID [32]byte` | One id type per entity. Never convert one id type into another. |
| Value object | Small immutable type | Built only by `NewX` or `ParseX`, which validates and returns `(X, error)`. Methods return a new value. |
| Entity | Struct with an id field of its own id type | Changes state only through methods that keep its invariants. Fields that an invariant guards are unexported. |
| DTO | Struct in an adapter package: HTTP body, sqlc row, message | Maps to and from the domain in one function per direction. A DTO MUST NOT enter the domain package. |
| Repository | Interface in the domain package, one per aggregate: `type LoginFlows interface { Lock(ctx, FlowID) (LoginFlow, error); Save(ctx, LoginFlow) error }` | Takes and returns entities, never DTOs. The adapter implements it. |

## Details

- Prefer a comparable underlying type, an array instead of a slice, so `==` and map keys work.
- Domain errors live in the domain package (`ErrFlowNotFound`). The adapter maps a driver error such as `pgx.ErrNoRows` to it. A driver error MUST NOT reach the domain.
- A secret type implements `String`, `Format`, and `slog.LogValuer` to print `redacted`.
- The domain package MUST NOT import an adapter package. The adapter imports the domain.

## References

- An HTTP server MUST follow [references/http-server.md](references/http-server.md): one route table drives the standard `ServeMux`, the auth wrapping, and the OpenAPI spec that `swaggest/openapi-go` generates from the request and response types; a slog middleware logs each request.
- A test MUST follow [references/testing.md](references/testing.md): testify and gofakeit for unit tests, testfixtures on a Postgres testcontainer for the DB, `httptest` through the real router for the API, Hurl against the shipped image for E2E.
