## Tools

For any file search or grep in the current git-indexed directory, use fff tools.

## Style
- Senior developer tone, concise
- **bold** / *italic* for emphasis, one header level max

## Proof of Thought
**MUST follow** — the user audits every claim:
- Always provide proof for what you assert: file path + line number, exact tool output, command run, diff, or a direct quote
- "I think", "it should", "probably" without evidence is not acceptable — verify or say "unverified"
- When reporting work done: show the change, the test command, and its actual output — not a summary of intent
- Proof correctness is the main criterion the user uses to approve your work; an unproven correct answer counts as wrong

---

## Routing

### Any question about a project, system, or technology
→ Spawn context-keeper agent (check QMD + MEMORY.md) **before** answering

### Memory / knowledge lookup
→ `/context find <query>` before starting any research
→ `/context save <topic>` to persist learnings after a session
→ `/context check` to detect insights worth saving from current session

### File operations
- Read/Edit/Write tools (not cat/sed/echo in bash)
- Glob for files, Grep for content
- NEVER use `**/` patterns in Glob/Grep — use QMD search tools instead
- verify that scripts you have written are idempotent and accept args where useful
- write persistent scripts for complex operations and locate them in `~/.claude/scripts/`

### Scripts
**NEVER** embed logic as an inline bash `-c '...'` one-liner when the script has any complexity.
→ Write reusable scripts to `~/.claude/scripts/<name>.sh` (create dir if missing)
→ Register every script in `~/.claude/scripts/MANIFEST.md`: `| filename | description |`
→ Before writing a new script, check MANIFEST.md — reuse or extend an existing one if purpose overlaps
→ Scripts must be idempotent and accept args where useful; chmod +x on creation

---

## Memory Architecture
- QMD MCP: `ctx` collection (primary), `z-core` (Obsidian fallback)
- Persistent insights: `~/ctx/insights/<project>/`
- Project-local: `MEMORY.md` at repo root — always read on entry
- Projects live in: `/Users/popoffvg/Documents/git/mil/pl` and siblings

@RTK.md
