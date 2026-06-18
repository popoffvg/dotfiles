---
name: code
description: >
  One entry point for spec writing, implementation, and bug fixing. Default is new
  (write spec → grill loop → produce notes → author TODO bodies). Other subcommands:
  verify (audit), revise (sync to shipped), prototype (settle a decision),
  code-map (diagram), impl (execute one TODO), fix (analyze cause, correct thoughts,
  fix behavior), help (this page). Invoke as /code <subcommand>.
argument-hint: help
---

# Code — subcommand router

> **Read first**: @workflow — pipeline, agents contract, notes structure, hard rules.

`/code <subcommand>`. Pick the operation, read its reference, follow it. Default is `new`.

## Subcommands

| `/code …` | You need to… | Reference |
|---|---|---|
| `new` *(default)* | Full spec pipeline: write `spec.md` (if missing) → grill loop (ask→answer→note) → produce `spec-notes/` → auto-write TODO bodies. One command, end to end. | `references/new.md` · `references/note-format.md` · `references/flow.md` · `references/todo.md` |
| `verify` | Audit spec before implementation — completeness, per-TODO files, execution readiness, scope discipline, test honesty. Returns READY / NEEDS REVISION. | `references/verify.md` |
| `revise` | Rewrite `spec.md` + `todos/TODO-N.md` to match what the last commit for TODO-N actually shipped. No source edits. | `references/revise.md` |
| `prototype` | Settle an OPEN design decision by spawning the implementer to make small, visible code changes. | `references/prototype.md` |
| `code-map` | Produce a D2 + SVG architecture map (package or component/type map) as visual aid. | `references/code-map.md` |
| `impl` | Execute one TODO — read context, replan guard, implement, autotest, commit, report. Delegates to `impl` skill for work/squash routing. | `../impl/SKILL.md` |
| `fix` | Fix behavior — analyze root cause, mark wrong notes, write corrected thoughts, fix code. | `references/fix.md` |
| `help` | This page — list all subcommands with descriptions. | (self) |

Internal reference: `references/flow.md` — TS pseudocode patterns for `## Changes`. Used by `new`.

## How they combine

```
research → new → verify → impl → revise (iterate)
```

- **new** is the default. It writes `spec.md` (if missing), runs the grill loop to empty
  Open Questions, produces `spec-notes/` thought graph, and auto-writes TODO bodies. One command
  replaces the old `write → new → todo` sequence.
- **verify** is the static audit gate. A spec with open questions cannot pass verify;
  run `new` again if the audit fails.
- **impl** executes one TODO end-to-end. Delegates to the `impl` skill.
- **fix** fixes broken behavior — analyze cause, correct thoughts, fix code.
- **prototype** and **code-map** are aids invoked mid-spec.
- **revise** runs after implementation, when what shipped diverged from the spec.
- **help** shows this page.

## Output shape

`new` and `revise` edit `<notes-dir>/spec.md` and `todos/TODO-N.md`.
`new` produces `<notes-dir>/spec-notes/NNN-{decision,fact,impl-decision}-slug.md`
(format: `references/note-format.md`).
`verify` writes `<notes-dir>/spec-verify.md`.
`fix` writes `<notes-dir>/spec-notes/NNN-*-slug.md` (corrected thoughts).
All write only under `<notes-dir>/` — never touch source code.
