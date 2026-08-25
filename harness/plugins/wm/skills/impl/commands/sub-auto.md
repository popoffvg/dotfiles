# code — auto

Drive the whole ledger unattended: every open TODO through implement → the `review` gate chain, then
deploy, then verify end-to-end. One invocation, no per-increment approval — the gates replace
the human.

Deterministic driver: the `wm-code-auto` workflow (`.claude/workflows/wm-code-auto.js`), which calls
`wm-code-impl` once per TODO for Step 2's gate chain. Run this file by hand only when no workflow
tool is available.

Obeys the shared subcommand rules (`code:ref-subcommand-rules.md`), except **source is written**: `auto`
drives `impl`, so the project source changes.

`impl` executes exactly one TODO and hands back. `auto` is the loop around it.

## Step 0 — the goal

/goal every TODO in the notes-dir ledger has status done, the deploy command ran green, and the E2E verification command ran green

The Stop hook is now armed. Start Step 1 — never pause to ask what to do; the condition is the
directive, and it clears itself once it holds.

## Step 1 — load the ledger

Read `<notes-dir>/spec.md` (frontmatter + ledger) and every `<notes-dir>/todos/TODO-N.md` — the human
halves carry the `status`, so they alone build the work list: each TODO whose `status` is not `done`, in
wave order (`arch:ref-write.md` § waves), respecting `depends_on`. Each TODO's `TODO-N.agent.md` is read
when its turn comes, not now.

Create `<notes-dir>/LESSONS.md` if it is missing (shape: the `carry-review-findings-in-a-lessons-file`
skill).

An empty work list skips to Step 3.

## Step 2 — the TODO loop

For **every** TODO in the work list, in order — not the first, not the easy ones:

1. **Read `<notes-dir>/LESSONS.md` in full.** Mandatory, every round, before any edit. It carries what
   the earlier rounds already cost.
2. **Implement one TODO** — follow `sub-impl.md`, with one change: it runs as `approve: none`
   (its § Approval) whatever the spec's key says. Nobody is watching. Apply each increment, keep the one-commit-per-TODO
   rule, and pass the lessons entries that touch this TODO's **Files** in the @implementer brief.
3. **The gate chain** — follow `review:sub-todo.md`: one haiku wave (lint, comments, names) in
   parallel, then the test gate, then the opus outcome gate. Any FAIL → return to 2 as a fixup commit
   with the findings quoted, and the chain restarts at the wave. That file owns the gates, their
   tiers, and the budget; this step owns nothing but the call.
4. **Squash this round's fixups** — follow `sub-squash.md`, scoped to this TODO: fold every `--fixup`
   commit the gate chain produced into the TODO's own commit (`git rebase --autosquash`), so the TODO
   leaves exactly one commit behind. Its distill step is where a fixup becomes a skill.
5. **Append to `<notes-dir>/LESSONS.md`** — what this round taught: findings that were real, findings
   rejected plus the command that settled them, gaps carried to a later TODO, process facts. Group by
   when the lesson bites, not by which gate produced it.
6. **Capture what the round taught outside the fixups** — invoke the `capture-lesson` skill
   (`self-improvement` plugin) on every lesson that produced no fixup: a finding a gate rejected and the
   command that settled it, a repo convention the reviewer named, a gap carried forward. `LESSONS.md`
   holds them for this run; a skill holds them for every future one.
7. **Advance the status** — `verify → done` on every gate green. Commit the notes-dir (`code:ref-jj-notes.md`).

A gate that exhausts its budget (`review:ref-gates.md` § The gate budget) blocks the TODO: record the
blocker in `LESSONS.md` and continue with the next TODO that no blocked TODO blocks. A blocked round
**skips the squash** — its fixups have nothing green to fold into — and still runs 5 and 6. Never
abandon the remaining work list because one TODO is stuck.

## Step 3 — deploy (optional)

Deploy is a step that may be **skipped**, never one that fails by being absent:

| The caller said | Step 3 does |
|---|---|
| nothing | probe for the task — the notes-dir `CLAUDE.md`, then `mise run deploy` / `make deploy` / a package script. Found → run it. None configured → **skip** |
| a command | run that command, no probe |
| no deploy | **skip** without probing — this ledger does not deploy |

Red → treat the failure as a new gap: `sub-fix.md`, then re-run the deploy. A skip is reported as a
skip with its reason, never left silent — an unmentioned deploy reads as a green one.

## Step 4 — verify end-to-end

Run the `E2E` command from the `## Autotest` of the last TODO in the ledger (`none` → skip, and say
which TODO declared it). Red → `sub-fix.md`, then re-run: **from Step 3 when the deploy ran**, from
Step 4 when it was skipped. Nothing waits on a step that never ran. Green → the goal condition holds
and the Stop hook clears itself.

## Step 5 — report

State, with real output and no summary of intent: TODOs done, TODOs blocked and why, TODOs skipped
because a blocked TODO blocks them, the deploy command and its result **or the skip and its reason**,
the E2E command and its result, and the new lines in `LESSONS.md`.
