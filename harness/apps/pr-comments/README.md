# pr-comments

The GitHub review threads of the PR of the current branch, shown in Zed on the lines they target. The server only reads: it does not reply to or resolve a thread.

## Install

```sh
mise run harness:pr-comments:build      # → ~/.local/bin/pr-comments-lsp
```

Then, once per machine, run `zed: install dev extension` and pick `harness/apps/pr-comments`. The rebuild rules of `harness/apps/line-comment/README.md` apply here too: rebuild from a Zed started in a shell, then run `editor: restart language server` on a served file.

The server calls `gh`, so `gh auth status` must pass in the repository.

After you install a language extension, regenerate the language list:

```sh
mise run harness:pr-comments:languages   # then `zed: rebuild dev extension`
```

## Use

Both code actions are offered on every line of every served file.

| Code action | Effect |
|---|---|
| `sync PR comments` | reads the threads with `gh`, saves them to `.tmp/pr-comments.json`, refreshes the lenses and the diagnostics, then does what `list PR comments` does |
| `list PR comments` | rewrites `.tmp/pr-comments.md` from the saved threads and opens it |

A sync shows its steps (find the PR, read the threads, save) as language-server progress in Zed's status bar, and as `[ 33%] …` lines in the task terminal. The server syncs only when you ask. A restart reads the threads of the last sync from `.tmp/pr-comments.json`.

The same sync is the Zed task `pr-comments: sync` (`task: spawn`), from the stowed `.config/zed/tasks.json`. It runs `pr-comments-lsp sync` in the worktree root, then opens the list page with `Zed.app/Contents/MacOS/cli --existing`. It does not call `zed` from the PATH: in a Zed task that name can be the app binary `Contents/MacOS/zed`, which reads `--existing` as a file name. Zed gives an extension no command palette entry, so the task is the way in from outside the code-actions menu. Both tasks run in the folder open in Zed (the worktree root) when it is in a git repository; when it is not, fzf lists its git repository subfolders, and you pick one. A task started from a commit or branch menu of the git panel uses that repository. The focused tab does not count. A failed run opens nothing, shows the error as a macOS notification, and appends it to `~/.cache/pr-comments-task.log`. The task `pr-comments: list` runs `pr-comments-lsp list` and opens the page the same way; it reads the threads of the last sync and calls GitHub for nothing. The server watches `.tmp/pr-comments.json`, so a sync from the task or a shell also refreshes the lenses and the diagnostics.

**Inline.** Each open thread on the head side of the diff gets a code lens on the row under its last line, `🐙 alice: <first line> (+2)`, and a `Hint` diagnostic over its lines. A click on the lens opens the thread in the browser. Resolved threads, outdated threads, and threads on a deleted line show only in the list.

**List.** Open `.tmp/pr-comments.md` in the markdown preview (`markdown: open preview to the side`). The two tasks do this themselves: after the open they press `cmd-shift-v` (`markdown::OpenPreview`) through System Events, because no task, CLI flag, or language-server request can open a preview. That needs Accessibility access for Zed in System Settings > Privacy & Security; without it a notification says so. Each thread has a heading, two links, the code ±5 lines with the commented lines marked `>`, and the comments. In the preview:

- `open in GitHub` opens the thread in the browser.
- `go to source` opens the file at the commented line.

The page path does not change, so a preview stays open across syncs and shows the new threads after each sync. A thread with no line in the working tree shows the tail of GitHub's diff hunk instead of the code.

**Line placement.** GitHub gives each line in the PR head commit. The server diffs the file at that commit (`git show <head>:<path>`) against the buffer text, so the lens follows commits you did not push, edits you did not commit, and edits you did not save. A thread whose line changed after the head commit goes to the nearest line and is marked `moved`. When the head commit is not in the local repo, the head line is used as it is. Run `git fetch` to fix that.

## Checks

```sh
mise run harness:pr-comments:test
```
