---
name: context-save
description: This skill should be used when the user says "context save", "remember this", "save this", "note this for later", "keep this", or wants to persist any knowledge, pattern, decision, or learning from the current session to persistent memory.
---

# Context Save

## Usage

`/context save <what to remember>`

## Configuration

Read `insights_root` from `~/.claude/memory-keeper.local.md` YAML frontmatter. If the file is missing, stop and ask the user to create it.

## Classifications

| Classification | What it is | Saved to |
|---|---|---|
| `insight` | Completed work — architecture, patterns, gotchas, decisions | `<insights_root>/<repo>/insights.md` |
| `agent_edit` | AI behavior changes — hooks, prompts, skills, CLAUDE.md, plugin config | `<insights_root>/claude-config/behavior.md` |
| `none` | Routine work, nothing worth recording — skip silently |

One save invocation may produce multiple entries with different classifications.

## Entry Format

```
## <Keyword-rich title, 3-7 words> — YYYY-MM-DD HH:MM

<Lead: direct statement of what this is and why it matters. 1-3 sentences.
Include concrete identifiers: file paths, function names, config keys, env vars.
No preamble — write for someone with zero memory of this session.>

### Subsection (only when topic has multiple distinct aspects)
<Details>
```

**Heading rules — the heading is the search key:**
- Include the main entity + key relationship
- Must be findable by someone who forgot: "what was that thing about X?"
- Good: `Pi session_shutdown: handler awaited before process.exit`
- Good: `RocksDB WAL mode: disable for unit test performance`
- Good: `Claude Code Stop hook fires per-turn not per-session`
- Bad: `Shutdown analysis`, `Important fix`, `Database stuff`

**Body rules:**
- Lead sentence must be self-contained — complete picture without reading more
- Never start with "In this session...", "We discovered...", "It was found..."
- State facts directly: "X does Y because Z"
- Subsections only for 2+ distinct concerns within the same topic

**Good entry:**
```
## Pi session_shutdown: handler fully awaited — 2026-03-19 10:00

Pi's `shutdown()` in `interactive-mode.js` calls `await extensionRunner.emit("session_shutdown")`
before `process.exit(0)` — handlers have unlimited time. The current fire-and-forget
`processAllPending().catch()` call is a bug: it escapes the await chain and gets killed.
Fix: either `await processAllPending()` directly, or spawn a detached child process.
```

**Bad entry (skip these):**
```
## Shutdown fix — 2026-03-19
- Fixed the shutdown issue
- Added await
```

## Repo Detection

Run `git -C <cwd> rev-parse --show-toplevel 2>/dev/null | xargs basename`. Fallback: `basename <cwd>`. User or conversation context may override.


## Deduplication

Before appending, read the target file and check:

1. **Exact heading match** → skip
2. **Semantic overlap** → skip (same fact, different words)
3. **New entry is broader** → replace old entry
4. **Existing entry is broader** → skip

One precise entry beats two fuzzy ones.
