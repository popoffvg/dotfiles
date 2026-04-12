---
name: context-check
description: This skill should be used when the user says "context check", "check for insights", "anything worth saving", "review session", or wants to analyze the current conversation for valuable learnings worth persisting — debugging discoveries, architectural decisions, corrections, workflow patterns.
---

# Context Check

Analyze the current conversation for facts worth persisting. Save immediately without asking.

## Usage

`/context check`

## What to extract

Scan the conversation for concrete, reusable knowledge:

**insight** — completed work worth remembering:
- How a system works (architecture, data flow, API behavior)
- Patterns applied and why they work
- Gotchas, pitfalls, surprising behaviors
- Decisions made with reasoning

**agent_edit** — AI behavior changes:
- Hook logic, prompt changes, skill updates
- CLAUDE.md or plugin config changes
- Directives that change how the assistant behaves

**none** — skip silently:
- Routine: "ran tests", "committed code", "read a file"
- Too vague: "fixed authentication issues"
- Too granular: "added field X to struct Y" (what is it FOR?)
- Numeric-only or empty friction notes (for example: "3") without concrete context

## Entry Format

```
## <Keyword-rich title, 3-7 words> — YYYY-MM-DD HH:MM

<Lead: direct statement of what this is and why it matters. 1-3 sentences.
Include concrete identifiers: file paths, function names, config keys.
No preamble. Write for someone with zero memory of this session.>

### Subsection (only when topic has multiple distinct aspects)
<Details>
```

**Heading = the search key.** Must be findable by someone who forgot the topic:
- Good: `Go context: cancel propagates through goroutine tree`
- Good: `better-sqlite3 native module: breaks on Node version upgrade`
- Bad: `Context stuff`, `Fixed bug`, `Important pattern`

**Lead sentence = complete picture.** Self-contained, states facts directly:
- Good: `Pi's shutdown() awaits all session_shutdown handlers before process.exit(0), giving handlers unlimited time for cleanup or LLM calls.`
- Bad: `In this session we discovered that the shutdown handler was being called...`

## Process

1. Scan the conversation — identify distinct topics with reusable value
2. For each topic: classify, write entry in wiki format
3. Deduplicate against target file (exact heading, semantic overlap, superset/subset)
4. Save immediately — do NOT ask for confirmation
5. Report: topic + classification + file saved to

If nothing worth saving: return "nothing worth saving".

## Autoresearch rules

**Eval checklist:**
1. Did the scan extract at least one concrete, reusable fact (not a vague observation)?
2. Was every extracted insight saved immediately without asking the user?
3. Were zero duplicate insights saved (already exists in memory)?
4. Did the extraction focus on debugging discoveries, architectural decisions, or corrections — not routine actions?

**Test inputs:**
- "Session where user debugged a tricky Kubernetes pod failure"
- "Session with only routine file edits, nothing novel"
- "Session where an architectural decision was made and rationale explained"

**Can change:** extraction criteria, insight categories, save format, scanning depth
**Cannot change:** save-without-asking behavior, QMD tool usage for persistence, removed `_tasks` routing
**Min sessions before eval:** 5
**Runs per experiment:** 3
