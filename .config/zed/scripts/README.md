# Zed task scripts

Scripts driven by an entry in `../tasks.json`. A task calls them as `$HOME/.config/zed/scripts/<name>.sh`. Stow does not link them: `.stow-local-ignore` skips `.config/zed`. Link each new script by hand with `ln -s "$PWD/<name>.sh" ~/.config/zed/scripts/<name>.sh` from this folder.

| script | task | what it does |
|---|---|---|
| `zed-pr-worktree.sh` | Github: PR review | Pick a PR (fzf over `gh pr list`), reuse its worktree or create one at `<repo>.pr-<N>`, fetch the PR target branch (`origin <base>:<base>`), set `git.diff_base: "default_branch"` in the worktree's `.zed/settings.json`, open it with `zed --existing`. |
| `zed-pr-worktree-clean.sh` | Github: clean PR review worktrees | List every `<repo>.pr-<N>` worktree of the repo, ask y/N, then remove each one that has no uncommitted changes (`.zed/settings.json` does not count). Delete its local branch only when `pull/<N>/head` on origin contains the branch tip. `--dry-run` lists only, `--yes` skips the prompt. |
| `cgrep-search.sh` | cgrep: find type, cgrep: find in code | `types`: list type definitions (`type`, `struct`, `class`, `interface`, ...) with cgrep in code only, pick one in fzf. `code`: rerun cgrep on each fzf query, skipping comments and string literals. rg supplies the file list, so `.gitignore` applies. The query starts from the selection. Opens the pick with `zed --existing file:line:col`. |
| `gh-send-review.sh` | Github: send review | Render the `line-comment-lsp` store as a report, ask before sending, submit it as one GitHub review with a comment on each note's line, then file the batch under `.tmp/review-session/<timestamp>/`. |
| `pr-comments-task.sh` | pr-comments: sync, pr-comments: list | Run `pr-comments-lsp sync` or `list` in the repository of the git-panel commit or branch menu it was started from, else in the worktree root when that is in a git repository, else ask in fzf which repository subfolder of the worktree root, then open `.tmp/pr-comments.md` with `cli --existing` and press `cmd-shift-v` (markdown: open preview) through System Events, which needs Accessibility access for Zed. A failure shows a notification and opens nothing. |

`gh-open.sh` is named by the "GitHub: open PR or branch" task. It is a plain file in `~/.config/zed/scripts/` and is not in this repo.

Review submissions retain `payload.json`, `report.md`, `response.json`, and `error.txt` under `.tmp/review-session/`. If submission cannot be confirmed, check the PR before retrying; the comment store stays in place. Run `python3 .config/zed/scripts/test_gh_send_review.py` from the dotfiles root to check the submission failure and success paths.
| `open-file-prompt.sh` | open file | Ask for `path[:line[:col]]` in a dialog prefilled with the first clipboard line, show the dialog again with `Not found: <path>` while the path does not exist, then open it in the current window with `cli --add`. Cancel or an empty answer opens nothing. |
| `new-worktree-thread.sh` | worktree: new thread | Ask for a task title in a dialog, create a worktree on a new branch named after the title with `wt switch --create`, open the worktree with `cli --existing`, then press `ctrl-alt-cmd-t` (`agent::NewTerminalThread` in `keymap.json`) through System Events to start a terminal thread there. System Events needs Accessibility access for Zed. Cancel opens nothing. |
