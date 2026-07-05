# code — impl

Execute **exactly one** TODO end-to-end, then stop and hand back.

## Steps

1. **Read context** — read `<notes-dir>/todos/TODO-N.md` in full, plus every file it cites. Read `@workflow` for pipeline conventions. If `spec.md` header `Status` is `review`, advance it to `impl` (implementation has begun).
2. **Replan guard** — if the TODO's assumptions no longer hold (the code moved, a dependency changed), stop and report instead of forcing the plan.
3. **Implement** — make the change. Bug fix? Follow `references/../../red-green-refactor/SKILL.md` (Red → Green → Refactor); never skip the failing test.
4. **Glossary** — if the change introduces or renames a domain term, update `<notes-dir>/GLOSSARY.md` in the same commit. Keep it current.
5. **Autotest** — run the TODO's `## Autotest`. Must be green before committing.
6. **Commit** — on green, commit per `references/commit.md`. The spec's `## Commit` block is the primary message.
7. **Report** — state what shipped, the test command + its real output, and stop. One TODO per invocation.

## Rules

- Log work + user intent to `<notes-dir>/worklog.md`.
- One commit per logical chunk; never batch unrelated changes; never stage unrelated files.
- User correction after a commit → fixup, not a fold-in (see `references/commit.md`).
- Worktree-isolated variant: `references/tree.md`.
