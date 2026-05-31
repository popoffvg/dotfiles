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
| `planner` | Writes `_notes/plan.md` + `todos/TODO-N.md` | `plan`, `plan-todo-prepare` |
| `researcher` | Explores codebase, writes `_notes/research-*.md` | `explore-research` |
| `implementer` | Executes one TODO, then stops | `impl` |
| `tester` | Designs/executes tests, writes report | `test-set-*`, `test-bdd`, `test-bdd-tdd`, `test-harness-plugin` |
| `codebase-analyzer` | Documents how code works | — |

### Skills (grouped by prefix)

- **explore-**: `explore`, `explore-flow-map`, `explore-handoff`, `explore-research`
- **plan-**: `plan`, `plan-flow`, `plan-verifier`, `plan-revise`, `plan-todo-prepare`, `plan-prototype`, `plan-code-map`
- **impl-**: `impl`, `impl-commit`
- **test-**: `test-bdd`, `test-bdd-tdd`, `test-set-create`, `test-set-verify`, `test-set-write`, `test-harness-plugin`, `test-verify`
- **review-**: `review-pr-comments`, `review-fix-comments`

Invoke directly as needed.

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
