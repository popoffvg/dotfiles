# TODO-1 — agent

**Design:** [TODO-1.md](TODO-1.md) — Outcome, Components, **Increments** (the work and its diff), Flow changes, Commit. Tests: [TODO-1.test.md](TODO-1.test.md).

> A filled `<notes-dir>/todos/TODO-N.agent.md` — **the agent half of the pair**. Copy the section
> order and the shape of each section, and delete the `>` lines — each one states the rules for the
> piece above it.
>
> **No frontmatter here.** `status` has one home, the human half, and a second copy of it drifts
> (`arch:sub-todo.md` § Required elements, which also carries the element list and order).
>
> `**Design:**` is the first line: the one link back to the human half, which links this file and the test file.
>
> The procedure around the file — the fan-out, the budgets, the verification chain, the pre-save
> checklist — is `arch:sub-todo.md`; the rules that cut across sections rather than sitting in one are
> `arch:ref-todo-sections.md`. The prose follows `harness-dev:text-style`.

## Files

- `pkg/auth/handler.go` — modify — inc 1, 3
- `pkg/auth/token.go` — modify — inc 2
- `pkg/auth/login.go` — modify — inc 2
- `pkg/auth/middleware.go` — modify — inc 3
- `cmd/api/routes.go` — modify — inc 3
- `pkg/auth/handler_test.go` — create — inc 3
- `scripts/release-check.sh` — create — inc 4
- `test/e2e/auth_refresh_test.go` — create — inc 3

> Every repo-relative path the increments are expected to touch, one line each: the path, `create` or
> `modify`, and the numbers of the human half's increments that touch it. This list is the only place
> a path meets an increment — the human half names symbols only. `impl` reads the lines of the
> increment it applies.
>
> **Recommended reading, not a border.** The list is where the implementer starts. The implementer MAY change a file outside it when the work needs it, and names that file in the increment report.
>
> Every non-test path maps to a `## Components` row in the human half — except a file changed only as
> a consequence of another row's decision, which carries no row of its own. Every increment has at
> least one line.

## Pre-reads (MUST read before editing)

- `pkg/auth/middleware.go` — existing token validation
- `pkg/redis/client.go` — Redis helpers used here

> Every file to understand before editing, one line each saying what to take from it.
>
> **Mandatory and never empty.** An implementer with no context needs the reading list even when the
> increments look self-explanatory.
>
> A component this TODO only *reads* belongs here rather than in the human half's `## Components` —
> that table is what the TODO changes.

## Manual test

- **Steps:**
  1. `make run-dev`
  2. `curl -X POST localhost:8080/auth/refresh -d '{"token":"<valid>"}'`
  3. `curl -X POST localhost:8080/auth/refresh -d '{"token":"<expired>"}'`
- **Expected:**
  1. dev server starts
  2. 200 with new `{access, refresh}` pair
  3. 401, Redis key `auth:<old>` absent (`redis-cli get auth:<old>` → nil)

> **Required even when Autotest covers the behaviour** — it catches the integration and the UX a suite
> cannot see.
>
> `Steps` are literal commands and `Expected` outcomes align 1:1 by number.
>
> To skip, the section is the single line `skip — reason: <specific>`.
>
> Keep only cases a test cannot prove: UX feel, log shape, real third-party behaviour, and a
> post-condition outside the code — a migration applied on staging, a feature flag flipped.

## Gotchas

- **inc 2 — `go test ./pkg/auth/...` passes with a stale Redis mock** — run `make mocks` before the test; the mock is generated and not in git. Evidence: `handler_test.go:41` failed only after `make mocks`.
- **inc 3 — `middleware.go` calls `Refresh` through an interface in `pkg/auth/iface.go`** — change the interface too; **Files** did not list it. Evidence: `go build ./...` → `iface.go:12: missing method Refresh`.

> **The implementer's memory for this TODO.** A context compact or a handoff to a new session loses
> every finding that lives only in the conversation. This section is the file the next session reads.
>
> `todo` writes no Gotchas section. `impl` and every @implementer create it with the first trap and
> append one bullet **the moment a trap is found** — before the next edit, never at the end of the increment.
>
> One bullet: `- **inc <n> — <trigger>** — <what to do instead>. Evidence: <file:line, or the command and its output>.`
> The same shape as `<notes-dir>/GOTCHAS.md` (`capture-gotcha` skill), plus the increment number.
>
> Keep a wrong assumption, a command that fails in a non-obvious way, a file **Files** missed, a
> fact about the code the pair did not state. Skip a status, a typo, and a fact the diff shows.
>
> `squash` promotes each bullet a later TODO can meet to `GOTCHAS.md`. The section stays in the file.
