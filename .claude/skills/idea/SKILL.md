---
name: idea
description: This skill should be used when the user says "idea", "I have an idea", "what if we", "we could", "it would be cool if", "feature idea", "improvement idea", or describes a potential feature, improvement, or exploration they want to capture for later.
---

# Idea

Capture ideas with full context so they're actionable later.

## Usage

`/idea <description of the idea>`

## Procedure

1. **Gather context inline** (fast, no subagent):
   - Repo name: `git rev-parse --show-toplevel | xargs basename`
   - Branch: `git branch --show-current`
   - Recent files: `git diff --name-only HEAD~3..HEAD 2>/dev/null`

2. **Spawn context-keeper agent** (haiku model) with this prompt:

```
Save an idea to memory. Use `memory_save` with type=`task` and the following content:

## <Idea title, 5-10 words> — <date>

**Context:** <repo> / <branch>
**Related files:** <recently changed files, if relevant>

<1-2 paragraphs expanding the idea: what it solves, rough approach, constraints>

### Open questions
- <Things to figure out before implementing>

---
Idea text: <user's idea>
Repo: <repo>
Branch: <branch>
Recent files: <files>
```

   The agent must:
   - First call `memory_context` to check for duplicate ideas
   - Then call `memory_save` with the formatted content

3. **Also write** the idea to `~/ctx/insights/_ideas/<slug>.md` (slug: lowercase, hyphens, max 60 chars) as a file backup.

4. **Report** the saved path and a one-line summary to the user.

## Rules

- **Use context-keeper agent** (haiku) for memory operations — never call MCP tools directly
- **One idea per invocation** — if the user gives multiple, spawn parallel agents
- **Dedup** — the agent checks memory before saving; if a match exists, it appends instead
