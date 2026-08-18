# code — impl

Execute **exactly one** TODO end-to-end, then stop and hand back. One TODO ships one deliverable as
one commit plus its fixups, built increment by increment — the user approves each increment's diff
before it is appended to that commit (`arch:sub-todo.md` § Changes). `squash` collapses the fixups back
into the one commit.

Obeys the shared subcommand rules — see `code:ref-subcommand-rules.md`.

Always call @implementer with background: true for implementation.

**The increment approval loop (step 5) runs in this session, not in the background agent** — a
background agent cannot ask the user anything. Delegate one increment's edit to @implementer at a
time and bring its diff back here for approval, or apply small increments directly.

## Steps

1. **Read context, staged — never the whole citation list up front.** Read `<notes-dir>/todos/TODO-N.md` in full (frontmatter + body): it is self-contained, so it alone says what to build. Of the files it cites, read only what the increment you are about to apply needs — that increment's **Files**, and the **Pre-reads** those files name. Every later increment's pre-reads are read in step 5, when you reach it. A TODO's Pre-reads list can span many files in several repos; reading all of them before increment 1 spends the whole session's context on files increment 1 never touches. The hard rules every subcommand obeys: `code:ref-subcommand-rules.md`. If the spec frontmatter `status` is `review`, advance it to `impl` (implementation has begun).
2. **Dependency gate** — if any `depends_on` TODO is not yet `status: done`, set this TODO's `status: blocked`, report, and stop. Never implement past an unmet dependency.
3. **Start** — set the TODO frontmatter `status: todo → impl`.
4. **Replan guard** — if the TODO's assumptions no longer hold (the code moved, a dependency changed), stop and report instead of forcing the plan.
5. **Implement increment by increment** — walk `## Changes` in order and, for **each** increment, do all four in this order:
   1. **Read, then apply** — read this increment's **Files** and the **Pre-reads** that name them (step 1 deliberately left them unread), then apply that increment's diff, and nothing outside its **Files**.
   2. **Show** the user the real `git diff` of what landed, next to the increment's predicted **Blast radius**. Say when the real diff exceeds the predicted radius — that is the signal the plan is wrong.
   3. **Wait for approval.** Approved → continue. Rejected → stop, report which increment was rejected and why, set `status: blocked`; apply nothing after it.
   4. **Append to the commit** — increment 1 creates the commit (`## Commit` message); every later approved increment is appended to that same commit with `git commit --amend --no-edit`. Exception: an increment that exists **because the user rejected or corrected a shown diff** is a user correction — commit it per `sub-commit.md` § Fixups, never amend it away.

   Never batch increments into one approval, and never re-order them: the sequence is deepest-first so the repo builds after each. Bug fix? Follow the `red-green-refactor` skill (Red → Green → Refactor); never skip the failing test — the failing test is its own first increment.
6. **Glossary** — if the change introduces or renames a domain term, update `<notes-dir>/GLOSSARY.md` in the same commit.
7. **Autotest** — run **both** commands in the TODO's `## Autotest`: `Unit` and `E2E`. Both green before committing (a level written `none` is skipped with its reason quoted in the report).
8. **Finalize the commit** — the commit already exists, built by step 5. On green, make its message match the `commit-message` skill (`## Commit` is the primary message) and fold in any test/glossary edits with `git commit --amend`. Then advance the TODO frontmatter `status: impl → verify` and fill the ledger row's Commit. `done` is set by the review gate (`reviewer`/`verifier`) on PASS; FAIL → `blocked`.
9. **Report** — state what shipped, how many increments were approved, the TODO's new `status`, the test command + its real output, and stop. One TODO per invocation.
