# code — impl

Execute **exactly one** TODO end-to-end, then stop and hand back. One TODO ships one deliverable as
one commit, built increment by increment — the user approves each increment's diff before it is
appended to that commit (`sub-todo.md` § Changes).

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

Always call @implementer with background: true for implementation.

**The increment approval loop (step 5) runs in this session, not in the background agent** — a
background agent cannot ask the user anything. Delegate one increment's edit to @implementer at a
time and bring its diff back here for approval, or apply small increments directly.

## Steps

1. **Read context** — read `<notes-dir>/todos/TODO-N.md` in full (frontmatter + body), plus every file it cites. Read `@workflow` for pipeline conventions. If the spec frontmatter `status` is `review`, advance it to `impl` (implementation has begun).
2. **Dependency gate** — if any `depends_on` TODO is not yet `status: done`, set this TODO's `status: blocked`, report, and stop. Never implement past an unmet dependency.
3. **Start** — set the TODO frontmatter `status: todo → impl`.
4. **Replan guard** — if the TODO's assumptions no longer hold (the code moved, a dependency changed), stop and report instead of forcing the plan.
5. **Implement increment by increment** — walk `## Changes` in order and, for **each** increment, do all four in this order:
   1. **Apply** that increment's diff, and nothing outside its **Files**.
   2. **Show** the user the real `git diff` of what landed, next to the increment's predicted **Blast radius**. Say when the real diff exceeds the predicted radius — that is the signal the plan is wrong.
   3. **Wait for approval.** Approved → continue. Rejected → stop, report which increment was rejected and why, set `status: blocked`; apply nothing after it.
   4. **Append to the commit** — increment 1 creates the commit (`## Commit` message); every later approved increment is appended to that same commit with `git commit --amend --no-edit`. One TODO stays one commit.

   Never batch increments into one approval, and never re-order them: the sequence is deepest-first so the repo builds after each. Bug fix? Follow `references/../../red-green-refactor/SKILL.md` (Red → Green → Refactor); never skip the failing test — the failing test is its own first increment.
6. **Glossary** — if the change introduces or renames a domain term, update `<notes-dir>/GLOSSARY.md` in the same commit.
7. **Autotest** — run **both** commands in the TODO's `## Autotest`: `Unit` and `E2E`. Both green before committing (a level written `none` is skipped with its reason quoted in the report).
8. **Finalize the commit** — the commit already exists, built by step 5. On green, make its message match `sub-commit.md` (`## Commit` is the primary message) and fold in any test/glossary edits with `git commit --amend`. Then advance the TODO frontmatter `status: impl → verify` and fill the ledger row's Commit. `done` is set by the review gate (`reviewer`/`verifier`) on PASS; FAIL → `blocked`.
9. **Report** — state what shipped, how many increments were approved, the TODO's new `status`, the test command + its real output, and stop. One TODO per invocation.
