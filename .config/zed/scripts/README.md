# Zed task scripts

Scripts driven by an entry in `../tasks.json`. A task calls them as `$HOME/.config/zed/scripts/<name>.sh`. Stow does not link them: `.stow-local-ignore` skips `.config/zed`. Link each new script by hand with `ln -s "$PWD/<name>.sh" ~/.config/zed/scripts/<name>.sh` from this folder.

| script | task | what it does |
|---|---|---|
| `zed-pr-worktree.sh` | Github: PR review | Pick a PR (fzf over `gh pr list`), reuse its worktree or create one at `<repo>.pr-<N>`, fetch the PR target branch (`origin <base>:<base>`), set `git.diff_base: "default_branch"` in the worktree's `.zed/settings.json`, open it with `zed --existing`. |
| `cgrep-search.sh` | cgrep: find type, cgrep: find in code | `types`: list type definitions (`type`, `struct`, `class`, `interface`, ...) with cgrep in code only, pick one in fzf. `code`: rerun cgrep on each fzf query, skipping comments and string literals. rg supplies the file list, so `.gitignore` applies. The query starts from the selection. Opens the pick with `zed --existing file:line:col`. |
| `gh-send-review.sh` | Github: send review | Render the `line-comment-lsp` store as a report, ask before sending, submit it as one GitHub review with a comment on each note's line, then file the batch under `.tmp/review-session/<timestamp>/`. |

`gh-open.sh` is named by the "GitHub: open PR or branch" task. It is a plain file in `~/.config/zed/scripts/` and is not in this repo.
