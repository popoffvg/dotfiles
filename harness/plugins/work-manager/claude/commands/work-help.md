---
name: work-help
description: Show available work commands, workflow, and tips
---

Display the following usage guide:

---

## Work Manager — Usage Guide

Work is driven by **agents and skills**, not an automated phase machine. You
invoke the agent you need; each agent follows its skill.

### Commands

| Command | What it does |
|---------|-------------|
| `/work:start` | Begin/resume work tracking — creates `_notes/`, initializes state |
| `/work:status` | Show current work status and recent progress |
| `/work:plan-revise <TODO-N> [<sha>]` | Rewrite plan.md + todos/TODO-N.md to match what the last commit for TODO-N actually shipped |
| `/work:abandon` | Cancel work-manager flow for this workspace |
| `/work:finish` | Alias for `/work:abandon` |
| `/work:help` | This guide |

### Agents

| Agent | Role | Skill |
|-------|------|-------|
| `planner` | Writes `_notes/plan.md` + `todos/TODO-N.md` | `plan`, `todo-prepare` |
| `researcher` | Explores codebase, writes `_notes/research-*.md` | `research` |
| `implementer` | Executes one TODO, then stops | `implement` |
| `codebase-analyzer` | Documents how code works | — |

### Skills

`plan`, `todo-prepare`, `plan-flow`, `plan-verifier`, `plan-revise`,
`research`, `implement`, `test-set-create`, `verify`, `commit`, `code-map`,
`prototype`, `pr-comments-fix`, `install` — invoke directly as needed.

### Work Notes Structure

```
<repo>/
  .pi/work.settings.json   # State: workId, name, status, branch
  _notes/                   # Git-tracked (separate git init)
    .git/                   # Independent git history
    plan.md                 # Plan with TODOs
    worklog.md              # Append-only progress log
    research-*.md           # Research findings
    todos/TODO-N.md         # Per-TODO instructions
```

### Tools (Pi side)

| Tool | Purpose |
|------|---------|
| `work_state` | Read/update `.pi/work.settings.json` |
| `work_start` | Initialize new work |
| `work_context` | Get plan + recent worklog |
| `work_abandon` | Cancel active work-manager flow |
