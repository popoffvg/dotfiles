---
name: worktree-merged-report.sh
description: Print one TSV row per git worktree with its branch, uncommitted file counts, commits not in the remote default branch, and the PR state of the branch.
args: "<worktree-dir>... (env NO_FETCH=1 skips fetch)"
---
