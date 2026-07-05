---
name: code
description: >
  One entry point for spec writing, implementation, and bug fixing. Default is new
  (write spec → grill loop → produce notes → author TODO bodies). Other subcommands:
  todo (author TODO bodies from an existing spec), verify (audit),
  revise (sync to shipped), prototype (settle a decision),
  code-map (diagram), impl (execute one TODO), tree (worktree-per-TODO: new/merge),
  squash (analyze fixups → CLAUDE.local.md → git squash), fix (correct a bug, missing
  part, or implementation adjustment by fixing the thought then the code),
  commit (commit-message conventions), help (this page).
  Invoke as /code <subcommand>.
argument-hint: help
---

# Code — subcommand router

> **Read first**: @workflow — pipeline, agents contract, notes structure, hard rules.

**NEVER write TODO comments in code** unless the user explicitly asks for them.

`/code <subcommand>`. Pick the operation, read its reference, follow it. Default is `new`.

## Subcommands

| `/code …` | You need to… | Reference |
|---|---|---|
| `new` *(default)* | Full spec pipeline: write `spec.md` (if missing) → grill loop (ask→answer→note) → produce `thoughts/` → auto-write TODO bodies. One command, end to end. | `references/new.md` · `references/note-format.md` · `references/flow.md` · `references/todo.md` |
| `todo` | Author (or rewrite) `todos/TODO-N.md` bodies from an existing `spec.md` + `thoughts/`, without rerunning the full `new` pipeline. | `references/todo.md` · `references/todo-template.md` · `references/flow.md` |
| `verify` | Audit spec before implementation — completeness, per-TODO files, execution readiness, scope discipline, test honesty. Returns READY / NEEDS REVISION. | `references/verify.md` |
| `revise` | Rewrite `spec.md` + `todos/TODO-N.md` to match what the last commit for TODO-N actually shipped. No source edits. | `references/revise.md` |
| `prototype` | Settle an OPEN design decision by spawning the implementer to make small, visible code changes. | `references/prototype.md` |
| `code-map` | Produce a D2 + SVG architecture map (package or component/type map) as visual aid. | `references/code-map.md` |
| `impl` | Execute one TODO — read context, replan guard, implement, autotest, commit, report. | `references/impl.md` |
| `tree` | Worktree flow. `tree new` *(default)*: implement one TODO in its own `wt` worktree+branch, committing fixups as you go. `tree merge`: invoke `squash`, then `wt merge` back. | `references/tree.md` |
| `squash` | Analyze the worktree's fixup commits → distill lessons into `CLAUDE.local.md` → `git` squash-merge the branch as one commit. Called by `tree merge`. | `references/squash.md` |
| `fix` | Close a gap — bug, missing part, or adjustment. Mark the wrong/outdated note (or add a new one), write the corrected thought, fix code. | `references/fix.md` |
| `commit` | Git commit-message conventions (`<prefix>: <why>`) — shared by `impl`, `tree`, `fix`. | `references/commit.md` |
| `help` | This page — list all subcommands with descriptions. | (self) |

Internal reference: `references/flow.md` — TS pseudocode patterns for `## Changes`. Used by `new`.

## How they combine

```
research → new → verify → impl → revise (iterate)
```

- **new** is the default. It writes `spec.md` (if missing), runs the grill loop to empty
  Open Questions, produces `thoughts/` thought graph, and auto-writes TODO bodies. One command
  replaces the old `write → new → todo` sequence.
- **todo** authors TODO bodies alone — use when `spec.md` + `thoughts/` exist but TODOs
  are missing or stale, instead of rerunning the full `new` pipeline.
- **verify** is the static audit gate. A spec with open questions cannot pass verify;
  run `new` again if the audit fails.
- **impl** executes one TODO end-to-end.
- **tree** is the worktree variant of impl: `tree new` isolates one TODO in a `wt`
  worktree+branch (commit fixups freely); `tree merge` runs `squash`, then `wt merge`.
- **squash** analyzes the worktree's fixup commits, distills lessons into `CLAUDE.local.md`,
  and `git` squash-merges the branch as one commit (invoked by `tree merge`).
- **commit** holds the shared commit-message conventions used by `impl`, `tree`, `fix`.
- **fix** closes a gap — a bug, a missing part, or an implementation adjustment — by correcting the thought, then the code.
- **prototype** and **code-map** are aids invoked mid-spec.
- **revise** runs after implementation, when what shipped diverged from the spec.
- **help** shows this page.

## Output shape

`new` and `revise` edit `<notes-dir>/spec.md` and `todos/TODO-N.md`.
`new` produces `<notes-dir>/thoughts/NNN-{decision,fact,impl-decision}-slug.md`
(format: `references/note-format.md`).
`verify` writes `<notes-dir>/spec-verify.md`.
`fix` writes `<notes-dir>/thoughts/NNN-*-slug.md` (corrected thoughts).
All write only under `<notes-dir>/` — never touch source code.
