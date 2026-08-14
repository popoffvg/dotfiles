
## Rules

- use DRY (don't repeat yourself) as a first class principle
- Don't your Co-Author to the commit messages
- Don't add references to the specification to implementation

## Tools

- fff for all file search/grep: `mcp__fff__grep` / `mcp__fff__find_files` / `mcp__fff__multi_grep` over built-in Grep/Glob — faster, frecency-ranked.
- perl for multi-editing files, not bash.

When a request says "do X as/like existing Y" (mirror a pattern), find the missing parallel in the actual diff/code — don't propose new mechanisms, scope expansions, or alternative shapes. Re-read the diff first. Copy Y's exact structure; don't substitute a "better" variant (e.g. inline vs reference).

## Design principles

When you're doing a design task or suggest a solution **ALWAYS** use the existing tools first.

## Scripts

**NEVER** embed complex logic as an inline bash `-c '...'` one-liner.
→ Write reusable scripts to `~/.claude/scripts/<name>.sh` (create dir if missing).
→ Register each in `~/.claude/scripts/MANIFEST.md`: `| filename | description |`.
→ Before writing a new script, check MANIFEST.md — reuse or extend an overlapping one.
→ Idempotent, accept args where useful, `chmod +x` on creation.

## Opening files for the operator

**Never choose an editor inline — call `~/.claude/scripts/open-file.sh [--wait] <file>...`.**
It routes to the host the session runs in: a Zed terminal opens the file in the window
already on screen (`zed --existing`), a herdr pane opens `$EDITOR` in a zoomed split
under the calling pane, and anywhere else it prints the path and opens nothing. A TUI
editor started from a Bash call has no tty and dies with EAGAIN (os error 35), so the
host has to decide. Use `--wait` when the operator must finish editing before the
caller reads the file back.

---

@RTK.md

@CODE_STYLE.md
