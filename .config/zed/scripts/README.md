# Zed task scripts

Scripts driven by an entry in `../tasks.json`. Stowed with the rest of `.config/zed`, so a task
calls them as `$HOME/.config/zed/scripts/<name>.sh`.

| script | task | what it does |
|---|---|---|
| `zed-pr-worktree.sh` | Github: PR review | Pick a PR (fzf over `gh pr list`), reuse its worktree or create one at `<repo>.pr-<N>`, fetch the PR target branch (`origin <base>:<base>`), set `git.diff_base: "default_branch"` in the worktree's `.zed/settings.json`, open it with `zed --existing`. |
| `gh-send-review.sh` | Github: send review | Render the `line-comment-lsp` store as a report, ask before sending, submit it as one GitHub review with a comment on each note's line, then file the batch under `.tmp/review-session/<timestamp>/`. |

`gh-open.sh` is named by the "GitHub: open PR or branch" task but has never existed here.
