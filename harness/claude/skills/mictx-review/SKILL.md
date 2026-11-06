---
name: mictx-review
description: >
  Judge one diff with the review gates — the unstaged tree ("check unstaged"),
  or this branch against main ("diff from main").
argument-hint: "[unstaged (default) | main] [fast] [mutation]"
---

# mictx-review

Judge whether one diff is built right. The gates, the wave, and the report are the `review` skill's diff mode: read `review:commands/sub-diff.md` from step 2 and `review:references/ref-gates.md`. This skill only chooses the diff.

The run reports and stops. Source stays read-only. The only accepted words are `unstaged`, `main`, `fast`, and `mutation`. Any other word stops the run: the reply names the two rows below and says any other range is `/review diff`.

## Steps

1. **Resolve the two trees.** Say which row fired. An empty `git diff --name-only "$BASE..$NOW"` stops the run as empty.

   | The caller said | Slug | `$BASE` | `$NOW` |
   |---|---|---|---|
   | nothing, or `unstaged` | `unstaged` | `git write-tree` (the index) | the worktree snapshot below |
   | `main` | `main` | `git merge-base HEAD <default>` | the same snapshot |

   Resolve `<default>` with `git symbolic-ref --short refs/remotes/origin/HEAD`. When that fails, use `main` when `refs/heads/main` exists, else `master` when `refs/heads/master` exists. When none of the three exists, stop and say the default branch is missing. Run `git merge-base HEAD <default>` once. On failure, stop and quote the error.

   The worktree snapshot starts from a copy of the index, so a tracked ignored file stays in it:

   ```sh
   t=$(mktemp)
   cp "$(git rev-parse --git-path index)" "$t"
   GIT_INDEX_FILE=$t git add -A
   NOW=$(GIT_INDEX_FILE=$t git write-tree)
   rm -f "$t"
   ```

   The range string is `$BASE..$NOW`. `fast` and `mutation` do not change the range. On an `unstaged` run, keep the stdout of `git diff --cached --name-only`; those paths are outside this diff.

   Done when `$BASE`, `$NOW`, the slug, and `$BASE..$NOW` are set and the diff is non-empty.

2. **Run the review diff mode from its step 2.** The range is `$BASE..$NOW`. The slug is the row's slug. `$SINCE` is `$BASE`. The tip a gate reads with `git show` is `$NOW`. The notes dir is `.notes` at the repo root when that path exists, otherwise `./.notes`. Pass `fast` and `mutation` through when the caller said them.

   On an `unstaged` run, after `<notes-dir>/review/<slug>/report.md` exists, put the kept `git diff --cached` stdout at the top under the heading `Staged, outside this diff`. When the command printed nothing, add no heading.

   Done when `<notes-dir>/review/<slug>/report.md` is written, the staged heading is in place or absent as that rule says, and the reply is that report.
