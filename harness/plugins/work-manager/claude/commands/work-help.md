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
| `/work:implement` | Enter implement phase in **autopilot** mode (all TODOs) |
| `/work:next` | Execute **one** TODO then stop (manual per-TODO mode) |
| `/work:abandon` | Cancel work-manager flow for this workspace |
| `/work:abandon-skill` | Run the skill-driven abandon flow |
| `/work:finish` | Alias for `/work:abandon-skill` |
| `/work:off` | Removed (use `/work:abandon`) |
| `/work:help` | This guide |

### Phases & Flow

```
research -> plan -> implement
              ^
              |
              <--------- (issues → back to plan)
```

| Phase | Description | Transition |
|-------|-------------|------------|
| **research** | Explore, gather context | -> plan |
| **plan** | Build task list, criteria | -> implement (via plan-verify) |
| **implement (autopilot)** | Execute all TODOs autonomously | -> plan (if issues found) |
| **implement (manual)** | One TODO per `/work:next` | -> plan (if issues found) |

When all TODOs are done, use `/work:abandon` to end the flow.

### Key Rules

- **plan -> implement**: must use explicit transition command
- **Each TODO = one feature-notable git commit** during implement
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

| `work_next` | Prepare next TODO execution prompt |
| `work_abandon` | Cancel active work-manager flow |
