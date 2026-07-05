# Glossary

Ubiquitous-language dictionary for this spec. Keep it current every phase — new, small, todo, impl, revise, fix.

| Term | Kind | Description |
|------|------|-------------|
| RefreshToken | entity | Opaque token in Redis, TTL-bound |
| AuthHandler | component | Serves `/auth/*` |
| RotateToken | command | SDK → Session; emits `TokenRotated` or `AuthRefreshFailed` |
| TokenRotated | event | Old token invalidated, new pair persisted |

> Purpose: let a human reading the spec check that the architector's domain model matches their own.
> Kind ∈ `entity | value-object | aggregate | component | service | policy | state | command | event`.
> Commands use imperative names and note who issues them and which events they emit. Events use past-tense names.
> Keep it short — only terms that appear in the Description or Goal.
