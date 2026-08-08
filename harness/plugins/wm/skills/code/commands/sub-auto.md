# code — auto

Drive the whole ledger unattended: every open TODO through implement → review → test, then deploy,
then verify end-to-end. One invocation, no per-increment approval — the review and test gates replace
the human.

Obeys the shared subcommand rules (`ref-subcommand-rules.md`), except **source is written**: `auto`
drives `impl`, so the project source changes.

`impl` executes exactly one TODO and hands back. `auto` is the loop around it.

## Step 0 — the goal

/goal every TODO in the notes-dir ledger has status done, the deploy command ran green, and the E2E verification command ran green

The Stop hook is now armed. Start Step 1 — never pause to ask what to do; the condition is the
directive, and it clears itself once it holds.

## Step 1 — load the ledger

Read `<notes-dir>/spec.md` (frontmatter + ledger) and every `<notes-dir>/todos/TODO-N.md`. Build the
work list: each TODO whose `status` is not `done`, in wave order (`ref-write.md` § waves), respecting
`depends_on`.

Create `<notes-dir>/LESSONS.md` if it is missing (shape: the `carry-review-findings-in-a-lessons-file`
skill).

An empty work list skips to Step 3.

## Step 2 — the TODO loop

For **every** TODO in the work list, in order — not the first, not the easy ones:

1. **Read `<notes-dir>/LESSONS.md` in full.** Mandatory, every round, before any edit. It carries what
   the earlier rounds already cost.
2. **Implement one TODO** — follow `sub-impl.md`, with one change: the per-increment approval loop
   (its Step 5.3) does not run. Nobody is watching. Apply each increment, keep the one-commit-per-TODO
   rule, and pass the lessons entries that touch this TODO's **Files** in the @implementer brief.
3. **Review gate** — @reviewer (read-only) over the real diff and `TODO-N.md`. FAIL → return to 2 as a
   fixup commit with the findings quoted. PASS → continue.
4. **Test gate** — @tester over the same diff. No test covers the TODO's `## Autotest` contract →
   **write the test first**, then re-run the gate. Comments or a red run → return to 2. Green →
   continue.
5. **Append to `<notes-dir>/LESSONS.md`** — what this round taught: findings that were real, findings
   rejected plus the command that settled them, gaps carried to a later TODO, process facts. Group by
   when the lesson bites, not by which gate produced it.
6. **Advance the status** — `verify → done` on both gates green. Commit the notes-dir (`ref-jj-notes.md`).

Three failed rounds on one gate → set that TODO `status: blocked`, record the blocker in
`LESSONS.md`, and continue with the next TODO that no blocked TODO blocks. Never abandon the
remaining work list because one TODO is stuck.

## Step 3 — deploy

Run the project's deploy task — `mise run deploy` / `make deploy` / the task the notes-dir `CLAUDE.md`
names. Red → treat the failure as a new gap: `sub-fix.md`, then re-run. No deploy task exists → say so
and continue to Step 4.

## Step 4 — verify end-to-end

Run the `E2E` command from the `## Autotest` of the last TODO in the ledger. Red → `sub-fix.md`, then
re-run from Step 3. Green → the goal condition holds and the Stop hook clears itself.

## Step 5 — report

State, with real output and no summary of intent: TODOs done, TODOs blocked and why, the deploy
command and its result, the E2E command and its result, and the new lines in `LESSONS.md`.
