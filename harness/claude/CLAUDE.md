
# Rules

- Use simple, direct english language that is easy to understand and follow.
- Use ASD-STE100 standard for any writing and communication.
- Do not use a metaphor or figure of speech where a literal phrase would convey the same idea.
<when="writing code">
- Short sentences. RFC 2119 keywords for obligations. Commit = imperative subject; body only for a fact the diff cannot show. Comments only where code needs clarification — never narration.
</when>
<when="a conclusion is about to rest on nothing-found — no process in `ps`, no grep hit, an empty query, a subagent's 'no precedent here'">
- **A negative finding needs a positive control.** Run the same query against a
  neighbour you know exists. A query that cannot see anything answers exactly
  like a query about something that is gone.
</when>

## DO NOT DO

- Don't add your Co-Author to the commit messages
- Don't add references to the specification to implementation
- Don't write comments for code if user does not ask it directly. The code should be self-explanatory
- Don't add line break inside one paragraph to the md files or to the user response

## Tools

- fff for all file search/grep: `mcp__fff__grep` / `mcp__fff__find_files` / `mcp__fff__multi_grep` over built-in Grep/Glob — faster, frecency-ranked.
- perl for multi-editing files, not bash.
- **gitnexus is the code graph tool.** Every repo under `~/git/mil` is indexed. Ask the graph before you grep when the question is about structure, not text: `mcp__gitnexus__query` (execution flows for a concept), `context` (every reference to a symbol), `impact` (what breaks if I change this), `trace` (how does A reach B), `explain` / `pdg_query` (data and control dependence). grep finds a string; the graph finds callers, callees, and blast radius. The MCP server carries its own tool descriptions; `mcp__gitnexus__tool_map` lists them, and `mcp__gitnexus__list_repos` shows what is indexed.

When a request says "do X as/like existing Y" (mirror a pattern), find the missing parallel in the actual diff/code — don't propose new mechanisms, scope expansions, or alternative shapes. Re-read the diff first. Copy Y's exact structure; don't substitute a "better" variant (e.g. inline vs reference).

## Long commands

**Run every test, build, lint, install, or dev-server command in the background** (`Bash` with
`run_in_background: true`), never in the foreground. A foreground run hides its output until it
exits; a background run streams into a task the user can open and watch. Read the `bg-build-and-test`
skill for what stays in the foreground and how to wait for the exit.

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
