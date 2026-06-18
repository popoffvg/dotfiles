---
name: workflow
description: >
  WM pipeline and conventions shared across all phases.
  Agents must read this before spec, impl, or verify work.
---

# Workflow — shared conventions

All WM agents follow this pipeline. Deviation requires user approval.

## Pipeline

```
research → spec → spec-verify → implement → verify → done
```

| Phase | Agent | Skill | Deliverable |
|---|---|---|---|
| research | `researcher` | `explore-research` | `.notes/research-*.md` |
| spec | `planner` | `code new` | `.notes/spec.md` |
| spec-verify | `planner` | `code verify` | `.notes/spec-verify.md` |
| implement | `implementer` | `impl` | Commit + `.notes/worklog.md` |
| verify | `verifier` | `impl-verify` | `.notes/verify-TODO-N.md` |

Each phase is invoked by the user. There is no FSM — agents don't auto-advance.

## Agents contract

- **One TODO per agent run.** No looping. Implementer stops after one commit; verifier stops after one verdict.
- **Hand off after completion.** Agents report and wait for the user. User decides next step.
- **Read-only on plan.** Only the planner writes `.notes/spec.md`. Others read it, never edit.
- **Replan → planner.** If implementation or verification reveals a spec gap, delegate to the planner. Don't redesign ad-hoc.
- **Read-only on source (verifier).** The verifier never edits production code.

## Notes structure

```
<repo>/
  .pi/work.settings.json   # Work state: workId, name, status, branch
  .notes/                   # Git-tracked (separate git init)
    spec.md                 # Plan: target picture, terms, decisions, TODO index
    worklog.md              # Append-only: each agent entry = date + TODO + commit sha + summary
    research-*.md           # Researcher output
    spec-verify.md          # Planner's spec audit verdict
    verify-TODO-N.md        # Verifier's post-implementation verdict
    todos/
      TODO-1.md             # Implementer-grade instructions: Type, Outcome, Terms, Changes, Autotest, Manual test
      TODO-2.md
      ...
```

- `.notes/` has its own `git init` — commits are independent from the repo.
- `worklog.md` is append-only. Each line starts with `- YYYY-MM-DD HH:MM:`.
- `spec.md` has a `## TODO List` index; individual TODO bodies live in `todos/`.

## Work state

Tracked in `.pi/work.settings.json`:
- `workId` — unique identifier
- `name` — human-readable name
- `status` — `"active"` or `"done"`
- `branch` — feature branch name

No phase tracking in state — work is agent-driven, not FSM-driven.

## Hard rules

- Never edit `.notes/spec.md` outside the spec phase.
- Never run more than one TODO per agent invocation.
- Commit after green Autotest. Do not commit failing tests.
- Do not stage unrelated files. Do not commit test-only changes under `feat`/`fix`.
- If a tool returns a permission error, ask the user — don't retry blindly.
- Every agent logs to `worklog.md` after completing its task.

## Phase detail

For phase-specific instructions, follow the skill mapped above:
- `/code <new|verify|revise|prototype|code-map|impl|fix|help>` — code router (spec + impl + fix)
- `/impl work` — implement one TODO
- `/impl squash` — learn from fixups (called by `merge-subtree`)
- `impl-verify` — adversarial post-implementation verification
- `impl-subtree` — experimental worktree-per-TODO flow
