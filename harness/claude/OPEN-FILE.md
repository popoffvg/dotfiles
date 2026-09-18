# Opening files for the operator

**Never choose an editor inline — call `~/.claude/scripts/open-file.sh [--wait] <file>...`.** It routes to the host the session runs in: a Zed terminal opens the file in the window already on screen (`zed --existing`), a herdr pane opens `$EDITOR` in a zoomed split under the calling pane, and anywhere else it prints the path and opens nothing. A TUI editor started from a Bash call has no tty and dies with EAGAIN (os error 35), so the host has to decide.

**`--wait` blocks in a herdr pane only.** In a Zed terminal `zed --wait` returns after a few seconds while the tab stays open, so the call proves nothing about the operator. Never read a file back because `--wait` returned — ask the operator to confirm the edit is done, or watch the file's mtime. Never call `zed` without `--existing`: it opens a second window instead of using the one on screen.
