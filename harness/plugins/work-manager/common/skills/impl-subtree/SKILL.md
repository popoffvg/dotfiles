---
name: impl-subtree
description: >
  EXPERIMENTAL implement flow. Execute one TODO inside its own git worktree + branch, commit
  freely as work progresses, record the user's review corrections as `git commit --fixup`, then
  on merge: analyze the fixups via `/impl squash` and squash-merge the branch into the feature
  branch as ONE commit using the spec's commit message.
  Opt-in alternative to plain `impl` — isolates work in a separate tree.
argument-hint: [work, merge — merge is a dangerous human-guarded action, see merge-subtree]
---

# impl-subtree (experimental)

One TODO → one branch in one worktree → one squashed commit on the feature branch.

This is a **wrapper** around `impl work`. It adds subtree management (worktree creation, fixup
contract, merge) on top. The actual implementation logic is in `impl` — this skill only covers
what's different.

## Subcommands

| Subcommand | Does |
|---|---|
| `work` *(default)* | Steps 1–5 below: create worktree, record planned Outcome, delegate to `impl work`, take user-review fixups, record achieved Outcome. |
| `merge` | Step 6: hand to `merge-subtree` (which calls `/impl squash` for fixup analysis, then human-guarded squash-merge). |

## Main repo awareness

The worktree is a sibling directory of the main repo. Always resolve paths relative to the main
repo root, not the worktree:

```bash
ROOT=$(git rev-parse --show-toplevel)                                    # current tree (worktree or main)
MAIN=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")  # always the main repo root
```

Use `$MAIN` when reading/writing `<notes-dir>/`, `.pi/work.settings.json`, and `CLAUDE.local.md`.
Use `$ROOT` for file operations inside the current working tree.

## Contract

- **One TODO per run, one worktree per TODO.** Never touch the main working tree during implementation.
- **Report the Outcome twice.** Planned Outcome before work, achieved Outcome after — the before/after pair is the acceptance record the merge step checks.
- **Commit freely in the worktree.** `impl work` commits after green Autotest; additional commits as you progress.
- **User corrections = fixups.** Every change in response to a user review comment is `git commit --fixup=<sha>`, never a normal commit. This separates "what the spec asked for" from "what the user had to correct".
- **Merge = squash with the spec message.** The feature branch gets exactly one commit per TODO; its message is the TODO's `## Commit` block.
- **Learn before merge.** Fixup analysis is done by `/impl squash` (called by `merge-subtree` Step 2).

## Step 1: Create the subtree

The feature branch is the current branch (or the work-manager `branch` in `.pi/work.settings.json`).
The **task slug** comes from the work name in `.pi/work.settings.json` (`.name`), slugified —
lowercase, non-alphanumerics → `-`, trimmed. Fall back to the feature branch name.

```bash
MAIN=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
SLUG=$(jq -r '.name // empty' "$MAIN/.pi/work.settings.json" 2>/dev/null \
  | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
SLUG=${SLUG:-$(git -C "$MAIN" rev-parse --abbrev-ref HEAD)}
BRANCH="$SLUG/TODO-N"                                   # e.g. auth-refresh/TODO-3
WT="$MAIN/../$(basename "$MAIN")-$SLUG-TODO-N"          # sibling dir, '/' → '-'
git -C "$MAIN" worktree add "$WT" -b "$BRANCH" HEAD
cd "$WT"
```

- Branch name: `<task-slug>/TODO-N`.
- Worktree: sibling dir `<repo>-<task-slug>-TODO-N`.
- If that branch/worktree already exists, reuse it — do not recreate.

**Make CLAUDE.local.md readable in the worktree.** A worktree's directory walk never reaches the
main repo root, so a local-only `CLAUDE.local.md` is invisible. If git **tracks** it, every worktree
gets it; do nothing. If it's **untracked/gitignored** (the common case) and absent in the worktree,
symlink the main copy:

```bash
if [ -e "$MAIN/CLAUDE.local.md" ] && ! git -C "$MAIN" ls-files --error-unmatch CLAUDE.local.md >/dev/null 2>&1 \
   && [ ! -e "$WT/CLAUDE.local.md" ]; then
  ln -s "$MAIN/CLAUDE.local.md" "$WT/CLAUDE.local.md"
fi
```

Keep `CLAUDE.local.md` gitignored in repos that use this flow.

## Step 2: Record the planned Outcome (before work)

Before editing any code, copy the TODO's `## Outcome` verbatim into `<notes-dir>/worklog.md`:

```
- YYYY-MM-DD HH:MM: [TODO-N] start — Outcome (planned): <verbatim Outcome from TODO-N.md>
```

This is the acceptance anchor. The achieved Outcome (Step 5) is checked against it; the merge step
refuses to land work whose achieved Outcome diverges without a logged reason.

## Step 3: Implement

Load and follow `impl work` — it handles reading context, replan guard, language-routed
implementation, Autotest, and commit. All file operations stay inside the worktree.

Use the worktree's notes directory: `$ROOT/.notes/` (resolved inside the worktree, not `$MAIN`).

## Step 4: User review → fixups

When the user reviews the branch and asks for changes:

1. Make the edit, re-run the Autotest.
2. Commit as a fixup against the commit being corrected:
   ```bash
   git commit --fixup=<sha-of-commit-this-corrects>
   ```
   Use `git log --oneline <task-slug>/TODO-N` to find the right `<sha>`. If the correction spans
   several commits, fix up the earliest one it touches.
3. Tell the user the fixup is committed. Never fold a user correction into a normal commit.

Repeat until the user signals the branch is ready to merge ("merge it", "land it", "looks good — merge").

## Step 5: Record the achieved Outcome (after work)

When the branch is ready (Autotest green, fixups settled), write what the implementation actually
delivered into `<notes-dir>/worklog.md`, next to the planned Outcome from Step 2:

```
- YYYY-MM-DD HH:MM: [TODO-N] done — Outcome (achieved): <what the code now does, in Terms>
  - matches planned? <yes | diverged: …> — fixups: <n>
```

If the achieved Outcome diverged from the planned one, state why. The merge step reads this pair.

## Step 6: Merge (the `merge` subcommand)

Do not squash-merge inline. Load the **`merge-subtree`** skill and follow it. It:

1. Runs `/impl squash` to analyze fixups → CLAUDE.local.md lessons.
2. Human-guarded squash-merge into the parent feature branch with the spec's `## Commit` message.
3. Verifies the Outcome holds.
4. Runs `/spec revise <TODO-N>` if the achieved Outcome diverged from planned.
5. Cleans up the worktree and branch.

Every destructive git action confirmed individually by the user.

## Hard rules

- A user-review correction is **always** a `--fixup`, never a plain commit.
- The feature branch gets **exactly one** commit per TODO; its message comes from the spec, never from the fixup history.
- Record both the planned (Step 2) and achieved (Step 5) Outcome before merging.
- Never merge inline — always hand to `merge-subtree`.
- One TODO per run. Do not auto-advance to TODO-N+1.
- Never operate on the main working tree during Steps 1–5 — only inside the worktree.

## Relationship to other skills

- `impl` — the core implementation logic. `impl-subtree` wraps `impl work` with worktree management.
- `impl squash` — analyzes fixups and distills lessons. Called by `merge-subtree` Step 2.
- `merge-subtree` — the dangerous, human-guarded merge + cleanup (Step 6).
- `spec` (`revise`) — invoked by `merge-subtree` when the Outcome diverged.
- `impl-commit` — message format for in-branch commits and the final squashed message.
- `impl-verify` — run on the squashed commit after merge for an independent PASS/DEVIATES verdict.
