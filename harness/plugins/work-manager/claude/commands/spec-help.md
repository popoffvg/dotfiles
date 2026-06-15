---
name: spec-help
description: Show all /spec subcommands with one-line descriptions.
---

Display this table:

## `/spec <subcommand>` — full list

| Subcommand | Does |
|---|---|
| `write` *(default)* | Write/update `spec.md` — target picture (Description, Terms, Goal, What we're NOT doing, Design Decisions, Open Questions) + the TODO List index. |
| `new` | Grill the spec one question at a time, recommend an answer each, drive Open Questions to empty. |
| `todo` | Author per-TODO body files `todos/TODO-N.md` (Type → Outcome → Terms → Changes → Autotest). |
| `verify` | Audit a spec before implementation — READY / NEEDS REVISION. |
| `revise` | Rewrite `spec.md` + `todos/TODO-N.md` to match what the last commit actually shipped. |
| `prototype` | Settle an open design decision with a small, visible demonstrative diff. |
| `code-map` | Produce a D2 + SVG architecture map (package or component/type) for the spec. |

Flow: `write → new → verify → (todo) → implement → revise`.
