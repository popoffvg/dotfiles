---
name: idea
description: This skill should be used when the user says "idea", "I have an idea", "what if we", "we could", "it would be cool if", "feature idea", "improvement idea", or describes a potential feature, improvement, or exploration they want to capture for later.
---

# Idea

Capture ideas with full context so they're actionable later. **Always uses subagents** — never do inline work.

## Usage

`/idea <description of the idea>`

## Storage

Ideas are saved to `~/ctx/insights/_ideas/<slug>.md` — one file per idea.

## Procedure

1. **Spawn a context-gathering subagent** (Explore type) to collect:
   - Current repo name (`git rev-parse --show-toplevel | xargs basename`)
   - Current branch
   - Recently changed files (`git diff --name-only HEAD~3..HEAD 2>/dev/null`)
   - Active work context: check `_notes/plan.md` or `.pi/work.settings.json` if they exist

2. **Spawn an idea-writer subagent** (general-purpose) with the gathered context. The subagent must:
   - Generate a slug from the idea title (lowercase, hyphens, max 60 chars)
   - Write the idea file to `~/ctx/insights/_ideas/<slug>.md` using this format:

```markdown
## <Idea title, 5-10 words> — YYYY-MM-DD HH:MM

**Context:** <repo> / <branch>
**Related files:** <recently changed files, if relevant to the idea>
**Work context:** <active task summary, if any>

<1-3 paragraphs expanding the idea. Include:
- What problem it solves or what it improves
- Rough approach or key insight
- Any constraints or dependencies noticed>

### Open questions
- <Things to figure out before implementing>
```

3. **Report** the saved file path and a one-line summary to the user.

## Rules

- **Never save inline** — always delegate to subagents
- **Never skip context** — even if the idea seems simple, gather repo/branch/work state
- **One idea per file** — if the user gives multiple ideas, spawn parallel subagents
- **Dedup check** — the writer subagent should `ls ~/ctx/insights/_ideas/` and scan for duplicates by title similarity before writing. If a match exists, append to the existing file instead of creating a new one.
