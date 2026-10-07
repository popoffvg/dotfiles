# Patterns

The existing code each recurring need must use, and the reference files for this spec. Read by the
implementer, not by the human at the gate — nothing here needs the user's agreement.

> A filled `<notes-dir>/PATTERNS.md`. Copy the file, replace the rows, delete the `>` lines — each
> one states the rules for the section above it. Written by `/code new` Step 0; extended by `revise`
> and by any subcommand that finds a need the code meets again. It carries no decision
> and no open question — those are `thoughts/` notes.

## Need → use

| Need | Use | Reference |
|------|-----|-----------|
| Retry a failed call | `backoff.Retry` from `github.com/cenkalti/backoff/v4`, policy from `retry.Default()` | `internal/retry/policy.go:12` |
| Wait for a remote state | `gateway.Poll` with a `retry.Default()` policy — never a `for` loop with `time.Sleep` | `internal/gateway/poll.go:20` |
| Change an installation state | a transition with a guard on `lifecycle.InstallationFSM` — never a second state machine | `internal/lifecycle/installation_fsm.go:44` |
| Run independent calls at once | `errgroup.WithContext` from `golang.org/x/sync/errgroup` | `internal/deploy/apply.go:88` |
| Map a domain error to HTTP | the one mapper in `http.WriteError`; handlers return domain errors | `internal/http/errors.go:15` |
| Reach Redis | the `store.Store` interface — no `*redis.Client` outside `internal/store/` | `internal/store/redis.go:18` |

> **One row per need the code meets more than once.** `Need` is the job in plain words, as a
> search for it reads. `Use` names the existing symbol or the `go.mod` / `package.json` package that
> already does the job. `Reference` is the `path:line` that shows it in use.
>
> **The table is the reuse contract.** An increment whose work meets a `Need` uses that row's `Use`.
> The implementer quotes the row in its diff report. A need with no row is not free to hand-write:
> search the repo and its dependencies first, and add the row you find.
>
> A need the repo meets nowhere yet is a decision, so it belongs in `thoughts/` as a
> `NNN-decision-*.md` note, not here. The prose follows `harness-dev:text-style`.

## Reference files

- `internal/auth/session.go` — the shape every new session type mirrors.
- `internal/store/redis_test.go` — the table-test form the new tests copy.

> Files an implementer reads before writing, with one line saying what to take from each. Cited by
> a TODO's **Pre-reads** when that TODO needs it; this list is the corpus-wide set.
