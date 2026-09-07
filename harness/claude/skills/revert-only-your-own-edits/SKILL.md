---
name: revert-only-your-own-edits
description: Use before running git restore, git checkout --, git stash, or any bulk revert to undo an experiment you ran (a formatter, codemod, go fix, prettier, a build that rewrote files) — the target may carry the user's uncommitted work that the revert destroys.
---

`git restore <path>` reverts to HEAD, not to the state before the experiment. Anything uncommitted in that path — the user's in-progress edits, an earlier tool run — dies with it, unrecoverably (no reflog for uncommitted work).

Before running the experiment:

1. `git status --short <path>` — record which files were already dirty.
2. Back up the dirty ones (`cp`) or `git stash push` them before the tool runs.

To undo afterwards:

- Revert ONLY files that were clean beforehand. `git restore` each by name; never a whole directory.
- For a file that was already dirty, restore the backup — not HEAD.
- Prefer a scratch worktree or a copy of the tree for the experiment; then nothing needs reverting.

If a dirty file was already wiped: re-run the deterministic tool to regenerate it, say so plainly, and confirm the content matches what was there.
