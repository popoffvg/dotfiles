---
name: merge-subtree
description: >
  DANGEROUS, human-guarded merge of an impl-subtree `<task-slug>/TODO-N` worktree branch into its parent
  feature branch. Analyzes commits + fixups, distills the fixup lessons into the repo's
  CLAUDE.local.md, then squash-merges the branch as ONE commit using the spec's commit message and
  deletes the worktree/branch. Every git action that changes history or removes a tree requires
  explicit user confirmation first — nothing runs unattended. Invoked by impl-subtree at merge time.
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
ROOT=$(git rev-parse --show-toplevel)
BRANCH="<task-slug>/TODO-N"          # the branch impl-subtree created, e.g. auth-refresh/TODO-3
WT="$ROOT/../$(basename "$ROOT")-${BRANCH//\//-}"   # worktree dir: '/' → '-'
```

## Step 1: Analyze commits and fixups (read-only — no confirm needed)

```bash
git log --oneline --format='%h %s' "$BRANCH" ^<feature-branch>
```

Separate spec-driven commits from `fixup!` commits. For each fixup, state the one-line root cause
(what was assumed wrong, missed, or over-built). Show the user this analysis before any mutation.

## Step 2: Improve CLAUDE.local.md  ⚠ confirm

For each non-trivial fixup, draft a generalizable rule for `<repo>/CLAUDE.local.md` under
`## Self-improvement` (create section if absent). **Show the exact diff you propose; wait for
approval; then write and commit it on `$BRANCH`.** Skip pure typos.

## Step 3: Squash-merge with the spec message  ⚠ confirm

Show the user the exact target, source, and the full commit message (the TODO's `## Commit`
Subject + Description — never a fixup comment). On approval:

```bash
cd "$ROOT"                               # parent feature branch
git merge --squash "$BRANCH"            # ⚠ confirm before running
git commit -m "<TODO ## Commit Subject>" -m "<TODO ## Commit Description>"   # ⚠ confirm message
```

`--squash` collapses every commit (spec + fixups + the CLAUDE.local.md change) into one staged
change; the fixup messages are discarded. If `git merge --squash` reports conflicts, **stop** —
show them and hand back to the user; do not auto-resolve.

## Step 4: Verify the Outcome holds  ⚠ confirm before declaring done

Before cleanup, confirm the squashed commit delivers the TODO's `## Outcome` (run the Autotest, or
hand to `impl-verify`). If it DEVIATES, stop — do not delete the branch; the work is not done.

## Step 5: Clean up  ⚠ confirm (irreversible)

Only after a clean merge + Outcome check. Show both commands, confirm, then:

```bash
git worktree remove "$WT"
git branch -D "$BRANCH"
```

`branch -D` force-deletes; the branch's pre-squash history is gone after this. Confirm the squashed
commit exists on the feature branch *first*.

## Step 6: Log and report

Append to `<notes-dir>/worklog.md`:

```
- YYYY-MM-DD HH:MM: [TODO-N] merged to <feature-branch> as <squash-sha>
  - fixups absorbed: <n> — lessons → CLAUDE.local.md
  - Outcome verified: <yes/no>
```

Then send the user a **final report**. It MUST contain the TODO's `## Outcome`, verbatim, as the
headline — the whole point of the flow is that this Outcome now holds:

1. **Outcome** — the TODO's `## Outcome`, copied verbatim from `<notes-dir>/todos/TODO-N.md`.
2. **Achieved?** — `yes` (matches planned) | `diverged: <how>`, taken from the impl-subtree Step 6
   achieved-Outcome entry.
3. **Merged** — `<squash-sha>` on `<feature-branch>`, commit subject (the spec `## Commit` Subject).
4. **Autotest** — command + pass/fail from the Outcome check.
5. **Lessons** — fixups absorbed (`<n>`) and the CLAUDE.local.md rules added.

## Hard rules

- Never run a history-rewriting or tree-removing command without that step's explicit confirmation.
- The feature branch gets **exactly one** commit; its message comes from the spec, never the fixups.
- Never `branch -D` before the squashed commit is confirmed present on the feature branch.
- On any conflict or DEVIATES verdict: stop and hand back. Do not improvise.
