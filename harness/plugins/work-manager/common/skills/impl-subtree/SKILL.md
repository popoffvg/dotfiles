---
name: impl-subtree
description: >
  EXPERIMENTAL implement flow. Execute one TODO inside its own git worktree + branch, commit
  freely as work progresses, record the user's review corrections as `git commit --fixup`, then
  on merge: analyze the commits + fixups, write the lessons into the repo's CLAUDE.local.md
  self-improvement section, and squash-merge the branch into the feature branch as ONE commit
  using the spec's commit message (the user's fixup comments never reach feature history).
  Opt-in alternative to `impl` — reverses its no-commit / stop-and-handoff contract.
argument-hint: [work, merge — merge is a dangerous human-guarded action, see merge-subtree]
---

# impl-subtree (experimental)

One TODO → one branch in one worktree → one squashed commit on the feature branch.

Unlike `impl` (no commits, hand back to user), this flow **owns its commit boundary**. The user
reviews in-branch; their corrections land as `fixup!` commits and are absorbed — and learned
from — at merge time. Feature history sees a single clean commit, message taken from the spec.

## Subcommands

`/impl-subtree <work|merge>` (default `work`).

| Subcommand | Does |
|---|---|
| `work` *(default)* | Steps 1–5 below: create the worktree, record the planned Outcome, implement, commit, take fixups, record the achieved Outcome. |
| `merge` | Step 6: load the **`merge-subtree`** skill — the dangerous, human-guarded squash-merge into the parent feature branch. Every git action confirmed individually. |

## Contract

- **One TODO per run, one worktree per TODO.** Never touch the main working tree.
- **Report the Outcome twice to user.** Report the *planned* Outcome before implementing and the *achieved*
  Outcome after — the before/after pair is the acceptance record the merge step checks against.
- **Commit freely.** Commit each logical step as you go (`impl-commit` message rules).
- **User corrections = fixups.** Every change you make in response to a user review comment is a
  `git commit --fixup=<sha>`, never a normal commit. This is what lets the merge step separate
  "what the spec asked for" from "what the user had to correct".
- **Merge = squash with the spec message.** The feature branch gets exactly one commit; its
  message is the TODO's `## Commit` block, not the fixup comments.
- **Learn before you merge.** Fixups are signal. Distill them into `CLAUDE.local.md` so the next
  TODO doesn't repeat the mistake.

## Step 1: Create the subtree

The feature branch is the current branch (or the work-manager `branch` in `.pi/work.settings.json`).
The **task slug** comes from the work name in `.pi/work.settings.json` (`.name`), slugified —
lowercase, non-alphanumerics → `-`, trimmed. Fall back to the feature branch name if unset.

```bash
ROOT=$(git rev-parse --show-toplevel)
SLUG=$(jq -r '.name // empty' "$ROOT/.pi/work.settings.json" 2>/dev/null \
  | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
SLUG=${SLUG:-$(git rev-parse --abbrev-ref HEAD)}
BRANCH="$SLUG/TODO-N"                                   # e.g. auth-refresh/TODO-3
WT="$ROOT/../$(basename "$ROOT")-$SLUG-TODO-N"          # sibling dir, '/' → '-'
git worktree add "$WT" -b "$BRANCH" HEAD
cd "$WT"
```

- Branch name: `<task-slug>/TODO-N` (slug from the work name, `N` = TODO number).
- Worktree: sibling dir `<repo>-<task-slug>-TODO-N` (dir name can't hold the `/`).
- If that branch/worktree already exists, reuse it — do not recreate.

## Step 2: Record the planned Outcome (before work)

Before editing any code, copy the TODO's `## Outcome` verbatim into `<notes-dir>/worklog.md` as the
target you are committing to:

```
- YYYY-MM-DD HH:MM: [TODO-N] start — Outcome (planned): <verbatim Outcome from TODO-N.md>
```

This is the acceptance anchor. The achieved Outcome (Step 5) is checked against it; the merge step
refuses to land work whose achieved Outcome diverges from the planned one without a logged reason.

## Step 3: Implement

Follow `impl` Steps 2–5 (read TODO + `spec.md` Terms/Decisions + Pre-reads; mid-task replan
guard; implement exactly the **Changes**; run the **Autotest** until green or the 3-edit blocker).
Stay inside the worktree.

## Step 4: Commit as you go

Commit each coherent chunk immediately. Use the spec's `## Commit` **Subject** for the primary
commit; smaller follow-on commits get their own `impl-commit`-style messages. Do not wait for the
user to commit — that is the whole point of this flow.

## Step 5: User review → fixups

When the user reviews the branch and asks for changes:

1. Make the edit, re-run the Autotest.
2. Commit as a fixup against the commit being corrected:
   ```bash
   git commit --fixup=<sha-of-commit-this-corrects>
   ```
   Use `git log --oneline <task-slug>/TODO-N` to find the right `<sha>`. If the correction spans several, fix
   up the earliest one it touches.
3. Tell the user the fixup is committed. Never fold a user correction into a normal commit.

Repeat until the user signals the branch is ready to merge ("merge it", "land it", "looks good — merge").

## Step 6: Record the achieved Outcome (after work)

When the branch is ready (Autotest green, fixups settled), write what the implementation actually
delivered into `<notes-dir>/worklog.md`, next to the planned Outcome from Step 2:

```
- YYYY-MM-DD HH:MM: [TODO-N] done — Outcome (achieved): <what the code now does, in Terms>
  - matches planned? <yes | diverged: …> — fixups: <n>
```

If the achieved Outcome diverged from the planned one, state why. The merge step reads this pair.

## Step 7: Merge (the `merge` subcommand)

Do not squash-merge inline. The merge into the parent feature branch is **dangerous and
human-guarded** — load the **`merge-subtree`** skill and follow it. It confirms every git action
individually (analyze → CLAUDE.local.md → `git merge --squash` → cleanup), checks the achieved
Outcome, and squashes to one commit with the spec's message.

## Hard rules

- A user-review correction is **always** a `--fixup`, never a plain commit.
- The feature branch gets **exactly one** commit per TODO; its message comes from the spec, never
  from the fixup history.
- Record both the planned (Step 2) and achieved (Step 6) Outcome before merging.
- Never merge inline — always hand the merge to `merge-subtree` so every destructive action is
  individually confirmed.
- One TODO per run. Do not auto-advance to TODO-N+1.
- Never operate on the main working tree during Steps 3–6 — only inside the `<task-slug>/TODO-N` worktree.

## Relationship to other skills

- `merge-subtree` — the dangerous, human-guarded merge of the `<task-slug>/TODO-N` branch into its parent
  (Step 7). Owns the squash-merge, fixup analysis, CLAUDE.local.md learning, and cleanup.
- `impl` — the non-experimental flow (no commits, user owns the boundary). Mutually exclusive.
- `impl-commit` — message format used for the in-branch commits and the final squashed message.
- `impl-verify` — run on the squashed commit after merge for an independent PASS/DEVIATES verdict.
