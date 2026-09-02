# Glossary

Ubiquitous-language dictionary for this spec. Keep it current every phase — new, todo, impl, revise, fix.

| Term | Kind | Description | Avoid | Source |
|------|------|-------------|-------|--------|
| RefreshToken | entity | Opaque token in Redis, TTL-bound | refresh key, rtok | `pkg/auth/token.go:31` |
| AuthHandler | server | Serves `/auth/*` | auth router | `pkg/auth/handler.go:12` |
| RotateToken | command | SDK → Session; emits `TokenRotated` or `AuthRefreshFailed` | refresh, renew | `pkg/auth/rotate.go:44` |
| TokenRotated | event | Old token invalidated, new pair persisted | — | `pkg/auth/rotate.go:88` |

> Copy to `<notes-dir>/GLOSSARY.md`, empty, at `/code new` Step 0.
> Purpose: let a human reading the spec check that the architector's domain model matches their own.
> **Avoid** lists the other names in use for the same concept — the words the spec and the code stop using. `—` when there is only one name.
> **Source** is the `path:line` the term comes from, or the spec section that coins it when no code exists yet.
> `/dive docs` fills this file first, from the research artifacts' `## Terms` tables (`dive-docs:SKILL.md` § Glossary). A row it writes leaves **Kind** empty until the spec types it.
> Every new or renamed row is approved by the user before it lands — `code:ref-subcommand-rules.md` § Glossary.
> Kind is one word from one of two sets — data, or a **brick** (a running responsibility):
> data ∈ `aggregate | entity | value-object | event | state`;
> brick ∈ `command | service | flow | gateway | server | consumer | policy | scheduler | wiring`
> (roster, metric, and structure of each: the `arch` skill).
> Commands use imperative names and note who issues them and which events they emit. Events use past-tense names.
> Keep it short — only terms that appear in the Description or Goal.
> The prose follows `harness-dev:text-style`.
