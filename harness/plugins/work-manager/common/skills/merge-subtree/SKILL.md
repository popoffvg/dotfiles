---
name: merge-subtree
description: >
  DANGEROUS, human-guarded merge of an impl-subtree `<task-slug>/TODO-N` worktree branch into its parent
  feature branch. Delegates fixup analysis to `/impl squash`, then squash-merges the branch as ONE
  commit using the spec's commit message, syncs the spec to what actually shipped (`/spec revise`
  when the Outcome diverged), and deletes the worktree/branch. Every git action that changes history
  or removes a tree requires explicit user confirmation first — nothing runs unattended. Invoked by
  impl-subtree at merge time.
---

# merge-subtree (human-guarded)

Collapse a finished `<task-slug>/TODO-N` branch into one clean commit on the parent feature branch.

This rewrites/destroys state: it squashes history, discards the user's fixup commit messages, deletes
a branch, and removes a worktree. **Treat every action as irreversible. Confirm before each one.**

## Human-guard protocol — applies to every step

For **each** action that mutates git state (merge, commit, branch delete, worktree remove, and the
CLAUDE.local.md write):

1. **Show** the exact command(s) and the inputs (target branch, source branch, the commit message
   text, the file you will edit).
2. **Wait** for explicit user approval of *that specific action*. Approval of one action is not
   approval of the next.
3. **Run** only the approved command. If the user changes anything, re-show and re-confirm.
4. Never batch destructive actions behind a single yes. Never proceed on silence.

A denied or skipped action stops the flow — report state and hand back to the user. Do not work around it.

## Inputs

- The `<task-slug>/TODO-N` branch + its worktree (created by `impl-subtree`).
- The parent **feature branch** (current branch / `.pi/work.settings.json` `branch`).
- `<notes-dir>/todos/TODO-N.md` — its `## Commit` block is the final message; its `## Outcome` is
  the acceptance anchor.

Resolve the names once (used by every step below):

```bash
MAIN=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
FEATURE=$(git -C "$MAIN" rev-parse --abbrev-ref HEAD)
BRANCH="<task-slug>/TODO-N"          # the branch impl-subtree created, e.g. auth-refresh/TODO-3
WT="$MAIN/../$(basename "$MAIN")-${BRANCH//\//-}"   # worktree dir: '/' → '-'
```

## Step 1: Preview the branch (read-only — no confirm needed)

```bash
git log --oneline --format='%h %s' "$BRANCH" ^"$FEATURE"
```

Separate spec-driven commits from `fixup!` commits. Show the user a summary: total commits, fixup
count, what each fixup corrected. This is informational; the actual learning happens in Step 2.

## Step 2: Learn from fixups → CLAUDE.local.md  ⚠ confirm

Load and follow the **`impl squash`** skill. It:
- Re-reads the branch's commits + fixups for root-cause analysis.
- Drafts generalizable rules for `$MAIN/CLAUDE.local.md` under `## Self-improvement`.
- Shows the proposed diff, waits for approval, then writes.
- Leaves CLAUDE.local.md uncommitted if gitignored (the common case), or commits it as `chore: learn from TODO-N fixups` on the main feature branch if tracked.

`impl squash` owns the full learning workflow — do not duplicate its logic here.

## Step 3: Squash-merge with the spec message  ⚠ confirm

Show the user the exact target, source, and the full commit message (the TODO's `## Commit`
Subject + Description — never a fixup comment). On approval:

```bash
cd "$MAIN"                               # parent feature branch
git merge --squash "$BRANCH"            # ⚠ confirm before running
git commit -m "<TODO ## Commit Subject>" -m "<TODO ## Commit Description>"   # ⚠ confirm message
```

`--squash` collapses every commit (spec + fixups) into one staged change; the fixup messages are
discarded. The Step 2 CLAUDE.local.md edit is **not** part of this — it was written to the main tree
(uncommitted if local-only, or its own `chore:` commit if tracked), never into the feature commit.

If `git merge --squash` reports conflicts, **stop** — show them and hand back to the user; do not
auto-resolve.

## Step 4: Verify the Outcome holds  ⚠ confirm before declaring done

Before cleanup, confirm the squashed commit delivers the TODO's `## Outcome` (run the Autotest, or
hand to `impl-verify`). If it DEVIATES, stop — do not delete the branch; the work is not done.

## Step 5: Sync the spec to what shipped  ⚠ confirm

If the achieved Outcome **diverged** from the planned one (impl-subtree Step 5 logged
`diverged: …`, or the squashed change differs from the TODO's `## Changes`), the spec is now stale.
Invoke **`/spec revise <TODO-N>`** — it rewrites `<notes-dir>/spec.md` + `todos/TODO-N.md` to match
what the squash commit for TODO-N actually shipped. Run it against the squash commit from Step 3.

- **Show** the proposed spec/TODO diff; **wait** for approval; the revise skill writes only under
  `<notes-dir>/` (never source).
- If the achieved Outcome matched the planned one, skip and note "spec unchanged — shipped as
  planned".

## Step 6: Clean up  ⚠ confirm (irreversible)

Only after a clean merge + Outcome check + spec sync. Show both commands, confirm, then:

```bash
git worktree remove "$WT"
git branch -D "$BRANCH"
```

`branch -D` force-deletes; the branch's pre-squash history is gone after this. Confirm the squashed
commit exists on the feature branch *first*.

## Step 7: Log and report

Append to `<notes-dir>/worklog.md`:

```
- YYYY-MM-DD HH:MM: [TODO-N] merged to <feature-branch> as <squash-sha>
  - fixups absorbed: <n> — lessons → CLAUDE.local.md (via impl squash)
  - Outcome verified: <yes/no>
  - spec synced: <no — shipped as planned | yes — /spec revise on <squash-sha>>
```

Then send the user a **final report**. It MUST contain the TODO's `## Outcome`, verbatim, as the
headline:

1. **Outcome** — the TODO's `## Outcome`, copied verbatim from `<notes-dir>/todos/TODO-N.md`.
2. **Achieved?** — `yes` (matches planned) | `diverged: <how>`, taken from the impl-subtree Step 5
   achieved-Outcome entry.
3. **Merged** — `<squash-sha>` on `<feature-branch>`, commit subject (the spec `## Commit` Subject).
4. **Autotest** — command + pass/fail from the Outcome check.
5. **Lessons** — fixups absorbed (`<n>`) and the CLAUDE.local.md rules added (via `impl squash`).
6. **Spec sync** — `unchanged (shipped as planned)` | `/spec revise` rewrote spec.md + TODO-N.md
   to match the squash commit.

## Hard rules

- Never run a history-rewriting or tree-removing command without that step's explicit confirmation.
- The feature branch gets **exactly one** commit; its message comes from the spec, never the fixups.
- Never `branch -D` before the squashed commit is confirmed present on the feature branch.
- When the achieved Outcome diverged from the planned one, run `/spec revise <TODO-N>` (Step 5)
  before cleanup — never delete the branch while the spec still describes work that didn't ship.
- On any conflict or DEVIATES verdict: stop and hand back. Do not improvise.
