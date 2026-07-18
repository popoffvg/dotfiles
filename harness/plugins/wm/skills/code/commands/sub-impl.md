# code — impl

Execute **exactly one** TODO end-to-end, then stop and hand back.

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

Always call @implementer with background: true for implementation.

## Steps

1. **Read context** — read `<notes-dir>/todos/TODO-N.md` in full (frontmatter + body), plus every file it cites. Read `@workflow` for pipeline conventions. If the spec frontmatter `status` is `review`, advance it to `impl` (implementation has begun).
2. **Dependency gate** — if any `depends_on` TODO is not yet `status: done`, set this TODO's `status: blocked`, report, and stop. Never implement past an unmet dependency.
3. **Start** — set the TODO frontmatter `status: todo → impl`.
4. **Replan guard** — if the TODO's assumptions no longer hold (the code moved, a dependency changed), stop and report instead of forcing the plan.
5. **Implement** — make the change. Bug fix? Follow `references/../../red-green-refactor/SKILL.md` (Red → Green → Refactor); never skip the failing test.
6. **Glossary** — if the change introduces or renames a domain term, update `<notes-dir>/GLOSSARY.md` in the same commit.
7. **Autotest** — run the TODO's `## Autotest`. Must be green before committing.
8. **Commit** — on green, commit per `sub-commit.md`. The spec's `## Commit` block is the primary message. Then advance the TODO frontmatter `status: impl → verify` and fill the ledger row's Commit. `done` is set by the review gate (`reviewer`/`verifier`) on PASS; FAIL → `blocked`.
9. **Report** — state what shipped, the TODO's new `status`, the test command + its real output, and stop. One TODO per invocation.
