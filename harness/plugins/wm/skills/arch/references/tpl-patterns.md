# Patterns

Implementation patterns and reference files for this spec. Read by the implementer, not by the
human at the gate — nothing here needs the user's agreement.

## Patterns

| Pattern | Follow | Reference |
|---------|--------|-----------|
| Handler wiring | One handler per route, registered in the router constructor — never in `main` | `internal/http/router.go:40` |
| Error mapping | Domain error → HTTP status in one mapper; handlers return domain errors | `internal/http/errors.go` |
| Redis access | Through the `Store` interface only; no `*redis.Client` outside `internal/store/` | `internal/store/redis.go:18` |

> One row per pattern the increments must follow. `Follow` states the rule in one line; `Reference`
> is the `path:line` that already does it — a pattern with no existing example in the repo is a
> decision, so it belongs in `thoughts/` as a `NNN-decision-*.md` note, not here.

## Reference files

- `internal/auth/session.go` — the shape every new session type mirrors.
- `internal/store/redis_test.go` — the table-test form the new tests copy.

> Files an implementer reads before writing, with one line saying what to take from each. Cited by
> a TODO's **Pre-reads** when that TODO needs it; this list is the corpus-wide set.

> This file is the finished `<notes-dir>/PATTERNS.md`. Copy it there, replace the content with the
> real patterns, and delete every `>` line. Written by `/code new` Step 0; extended by `revise` and
> by any subcommand that discovers a pattern the increments must follow. It carries no decision and
> no open question — those are `thoughts/` notes.
