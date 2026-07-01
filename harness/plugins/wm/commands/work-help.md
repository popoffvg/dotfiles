---
name: work-help
description: Show available work commands, workflow, and tips
---

Print the following usage guide verbatim. No preamble, no commentary, no tool calls — output only the markdown below.

---

## WM — Usage Guide

Work is driven by **agents and skills**, not an automated phase machine. You
invoke the agent you need; each agent follows its skill.

### Commands

| Command | What it does |
|---------|-------------|
| `/work:start` | Begin/resume work tracking — creates `.notes/`, initializes state |
| `/work:status` | Show current work status and recent progress |
| `/work:spec-revise <TODO-N> [<sha>]` | Rewrite spec.md + todos/TODO-N.md to match what the last commit for TODO-N actually shipped |
| `/work:abandon` | Cancel wm flow for this workspace |
| `/work:finish` | Alias for `/work:abandon` |
| `/work:help` | This guide |

### Agents

| Agent | Role | Skill |
|-------|------|-------|
| `architector` | Writes `.notes/spec.md` + `todos/TODO-N.md` | `code new` |
| `researcher` | Explores codebase, writes `.notes/research-*.md` | `dive research` |
| `implementer` | Executes one TODO, then stops | `code impl` |
| `implementer-subtree` | *(experimental)* One TODO in its own `wt` worktree+branch; commits, fixups, squash-merges with spec message | `code tree` |
| `verifier` | Adversarially checks one implemented TODO vs its spec, writes `.notes/verify-TODO-N.md` | `impl-verify` |
| `tester` | Designs/executes tests, writes report | `test-suite` |
| `codebase-analyzer` | Documents how code works | — |

### Skills (grouped by prefix)

- **workflow**: shared pipeline, agents contract, notes structure, hard rules — read first by all agents
- **dive**: one router — `/dive <docs|workflow|research|flow-map>` (write the markdown research write-ups, the typed TS pseudocode + path bindings, document the codebase as-is, render flows.json as HTML). Plus `handoff` (standalone — compact a conversation into a handoff doc)
- **code**: one router — `/code <new|verify|revise|prototype|code-map|impl|tree|squash|fix|help>` (write spec, grill to empty Open Questions, auto-write TODO bodies, audit, sync, prototype, diagram, implement one TODO, implement-in-`wt`-worktree + merge, distill worktree fixup lessons, fix bugs)
- **impl-verify**: adversarial post-impl verification (the one surviving `impl-` skill). Commit conventions moved to `/code commit`; the experimental worktree-per-TODO flow now lives in `/code tree` + `/code tree merge` (`wt`-backed) with `/code squash` for fixup learning.
- **test**: one router — `/test-suite <create|write|verify|case-design|bdd|tdd|harness|review>` (design a pairwise-tiered strategy, enumerate a scenario/coverage matrix, audit an existing set, derive cases by black-box technique, shape BDD scenarios, drive spec-before-code TDD, test a plugin harness, run the verify-phase review)
- **review-**: `review-pr-comments`, `review-fix-comments`

Invoke directly as needed.

### Work Notes Structure

```
<repo>/
  .pi/work.settings.json   # State: workId, name, status, branch
  .notes/                   # Git-tracked (separate git init)
    .git/                   # Independent git history
    spec.md                 # Plan with TODOs
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
| `work_abandon` | Cancel active wm flow |
