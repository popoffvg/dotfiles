# Opening files for the operator

**Never choose an editor inline — call `~/.claude/scripts/open-file.sh [--wait] <file>...`.**
It routes to the host the session runs in: a Zed terminal opens the file in the window
already on screen (`zed --existing`), a herdr pane opens `$EDITOR` in a zoomed split
under the calling pane, and anywhere else it prints the path and opens nothing. A TUI
editor started from a Bash call has no tty and dies with EAGAIN (os error 35), so the
host has to decide. Use `--wait` when the operator must finish editing before the
caller reads the file back.
