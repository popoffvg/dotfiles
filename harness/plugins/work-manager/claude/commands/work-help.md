---
name: work-help
description: Show available work commands, workflow, and tips
---

Display the following usage guide:

---

## Work Manager v2 — Usage Guide

### Commands

| Command | What it does |
|---------|-------------|
| `/work:start` | Begin new work — creates `_notes/`, phase = plan |
| `/work:status` | Show current work status and progress |
| `/work:implement` | Enter implement phase (from plan only) |
| `/work:continue` | Continue implement phase with the next TODO |
| `/work:done` | Mark work complete |
| `/work:done-skill` | Run the skill-driven done flow (alternative) |
| `/work:finish` | Alias for `/work:done-skill` |
| `/work:off` | Disable work tracking for this session |
| `/work:help` | This guide |

### Phases & Flow

```
research -> plan -> implement -> auto-verify -> verify -> verified
              ^         ^           |                       |
              |         <-----------< (issues)              |
              <---------------------------------------------<
```

| Phase | Description | Transition |
|-------|-------------|------------|
| **research** | Explore, gather context | -> plan |
| **plan** | Build task list, criteria | -> implement (via command) |
| **implement** | Execute plan autonomously | -> auto-verify (auto) |
| **auto-verify** | LLM reviews diff vs plan | -> verify or -> implement |
| **verify** | User approves or rejects | -> verified or -> plan |
| **verified** | Done, normal chat mode | -> plan (if more work) |

### Key Rules

- **plan -> implement**: must use explicit transition command
- **auto-verify**: independent review of full diff, no code execution
- **Each TODO = one git commit** during implement
- **work_compact** called after each TODO to free context
- `_notes/` has its own git repo for plan evolution tracking

### Work Notes Structure

```
<repo>/
  .pi/work.settings.json   # State: phase, workId, status
  _notes/                   # Git-tracked (separate git init)
    .git/                   # Independent git history
    plan.md                 # Plan with TODOs and acceptance criteria
    worklog.md              # Append-only progress log
    research-*.md           # Research findings
    impl-learnings.md       # Implementation learnings per TODO
```

### MCP Tools (for agents)

| Tool | Purpose |
|------|---------|
| `work_state` | Read/update `.pi/work.settings.json` |
| `work_start` | Initialize new work |
| `work_transition` | Change phase |
| `work_guard` | Check if tool call is allowed |
| `work_context` | Get phase instructions + plan |
| `work_compact` | Signal TODO completion |
| `work_off` | Disable tracking |
