---
name: spec
description: >
  One entry point for all spec work. Use when the user wants to write or update a spec/plan
  (`<notes-dir>/spec.md` — target picture, terms, goal, decisions, TODO index), interrogate a
  spec until every Open Question is resolved, author per-TODO body files, audit a spec for
  readiness before implementation, revise a spec to match what a commit actually shipped,
  prototype an open design decision, or draw a package/component code map for the spec. Also the
  skill for the work-manager "spec" and "spec-verify" phases. Invoke as
  `/spec <write|new|todo|verify|revise|prototype|code-map>` (default `write`).
argument-hint: [write, new, todo, verify — full list /spec-help]
---

# Spec — subcommand router

> **Read first**: @workflow — pipeline, agents contract, notes structure, hard rules.

`/spec <subcommand>`. Pick the operation, read its reference, follow it. Default subcommand is
`write`. The artifact is `<notes-dir>/spec.md` plus `<notes-dir>/todos/TODO-N.md`.

## Subcommands

| `/spec …` | You need to… | Reference |
|---|---|---|
| `write` *(default)* | Write/update `spec.md` — target picture (Description, Terms, Guidelines, Goal, What we're NOT doing, Design Decisions, Open Questions) + the TODO List index of outcomes. No code, no TODO bodies. | `references/write.md` |
| `new` | Interrogate the spec relentlessly — grill-me loop, one question at a time, recommend an answer each, walk the decision tree depth-first, write resolutions back, drive Open Questions to empty. Pre-impl half of verification. | `references/new.md` |
| `todo` | Author per-TODO body files `todos/TODO-N.md` for a dummy implementer (Type → Outcome → Terms → Changes → Autotest → scaffolding). | `references/todo.md` |
| `verify` | Audit a spec before implementation — completeness, per-TODO files, execution readiness, scope discipline, test honesty. Returns READY / NEEDS REVISION. work-manager "spec-verify" phase. | `references/verify.md` |
| `revise` | Rewrite `spec.md` + `todos/TODO-N.md` so they match what the last commit for TODO-N actually shipped. No source edits. | `references/revise.md` |
| `prototype` | Settle an OPEN design decision by spawning the implementer to make small, visible code changes that demonstrate one shape of the answer. | `references/prototype.md` |
| `code-map` | Produce a D2 + SVG architecture map (package map or component/type map) as a visual aid for the spec. | `references/code-map.md` |

Internal reference (not a direct subcommand): `references/flow.md` — TS pseudocode patterns for the
`## Changes` section. Both `write` and `todo` point at it.

## How they combine

```
research → write → new → verify → (todo) → implement → revise (iterate)
```

- **write** paints the target picture and the TODO List of outcomes — the discussion surface. It stops before TODO bodies.
- **new** drives the spec to shared understanding: it empties Open Questions. A spec with open questions cannot pass **verify**.
- **verify** is the static audit gate (hard-blocks non-empty Open Questions, enforces test honesty). **new** is the interactive loop that gets the spec there.
- **todo** is a separate, user-initiated action that writes the implementer-grade body files; **flow** governs how their `Changes` read.
- **prototype** and **code-map** are aids invoked mid-spec when a decision needs a real diff or a diagram to settle.
- **revise** runs after implementation, when what shipped diverged from the spec.

## Output shape

`write` / `new` / `revise` edit `<notes-dir>/spec.md` (and `todos/TODO-N.md`). `todo` writes
`<notes-dir>/todos/TODO-N.md` — skeleton in `references/todo-template.md`, worked example in
[`examples/TODO-example.md`](examples/TODO-example.md). `verify` writes `<notes-dir>/spec-verify.md`.
All write only under `<notes-dir>/` — never touch source code.
