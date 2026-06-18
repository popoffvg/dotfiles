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
| `/work:start` | Begin/resume work tracking — creates `.notes/`, initializes state |
| `/work:status` | Show current work status and recent progress |
| `/work:spec-revise <TODO-N> [<sha>]` | Rewrite spec.md + todos/TODO-N.md to match what the last commit for TODO-N actually shipped |
| `/work:abandon` | Cancel work-manager flow for this workspace |
| `/work:finish` | Alias for `/work:abandon` |
| `/work:help` | This guide |

### Agents

| Agent | Role | Skill |
|-------|------|-------|
| `planner` | Writes `.notes/spec.md` + `todos/TODO-N.md` | `spec` |
| `researcher` | Explores codebase, writes `.notes/research-*.md` | `explore-research` |
| `implementer` | Executes one TODO, then stops | `impl` |
| `implementer-subtree` | *(experimental)* One TODO in its own worktree+branch; commits, fixups, squash-merges with spec message | `impl-subtree` |
| `verifier` | Adversarially checks one implemented TODO vs its spec, writes `.notes/verify-TODO-N.md` | `impl-verify` |
| `tester` | Designs/executes tests, writes report | `test-suite` |
| `codebase-analyzer` | Documents how code works | — |

### Skills (grouped by prefix)

- **workflow**: shared pipeline, agents contract, notes structure, hard rules — read first by all agents
- **explore**: one router — `/explore <docs|workflow>` (write the markdown research write-ups + question lists, then the typed TS pseudocode + path bindings). Plus `explore-flow-map`, `explore-handoff`, `explore-research`
- **spec**: one router — `/spec <write|new|todo|verify|revise|prototype|code-map>` (write the spec, interrogate it until Open Questions is empty, author TODO bodies, audit readiness, sync to a shipped commit, prototype a decision, draw a code map)
- **impl-**: `impl`, `impl-commit`, `impl-verify` (adversarial post-impl verification), `impl-subtree` (*experimental* — worktree+branch per TODO, commit-as-you-go, fixup corrections; records planned/achieved Outcome), `merge-subtree` (*experimental, human-guarded* — squash-merge a `<task-slug>/TODO-N` branch into its parent, every git action confirmed)
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
| `work_abandon` | Cancel active work-manager flow |
