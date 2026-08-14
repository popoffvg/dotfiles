# Glossary

Ubiquitous-language dictionary for this spec. Keep it current every phase — new, todo, impl, revise, fix.

| Term | Kind | Description |
|------|------|-------------|
| RefreshToken | entity | Opaque token in Redis, TTL-bound |
| AuthHandler | server | Serves `/auth/*` |
| RotateToken | command | SDK → Session; emits `TokenRotated` or `AuthRefreshFailed` |
| TokenRotated | event | Old token invalidated, new pair persisted |

> Purpose: let a human reading the spec check that the architector's domain model matches their own.
> Kind is one word from one of two sets — data, or a **brick** (a running responsibility):
> data ∈ `aggregate | entity | value-object | event | state`;
> brick ∈ `command | service | flow | gateway | server | consumer | policy | scheduler | wiring`
> (roster, metric, and structure of each: the `arch` skill).
> Commands use imperative names and note who issues them and which events they emit. Events use past-tense names.
> Keep it short — only terms that appear in the Description or Goal.
