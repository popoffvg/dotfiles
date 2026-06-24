---
name: code-help
description: Show all /code subcommands with one-line descriptions.
---

Display this table:

## `/code <subcommand>` — full list

| Subcommand | Does |
|---|---|
| `new` *(default)* | Full pipeline: write spec.md (if missing) → grill loop → produce spec-notes/ → auto-write TODO bodies. |
| `verify` | Audit a spec before implementation — READY / NEEDS REVISION. |
| `revise` | Rewrite `spec.md` + `todos/TODO-N.md` to match what the last commit actually shipped. |
| `prototype` | Settle an open design decision with a small, visible demonstrative diff. |
| `code-map` | Produce a D2 + SVG architecture map (package or component/type) for the spec. |
| `impl` | Execute one TODO — pick, read context, replan guard, implement, autotest, commit, report. |
| `tree` | Implement one TODO in a `wt` worktree+branch; `tree merge` squash-merges it back (`wt merge`). |
| `squash` | Distill lessons from a worktree's fixups into `CLAUDE.local.md` (called by `tree merge`). |
| `fix` | Fix behavior — analyze root cause, mark wrong notes, write corrected thoughts, fix code. |
| `commit` | Git commit message conventions (`<prefix>: <why>`) — shared by `impl`, `tree`, `fix`. |
| `help` | This page. |

Flow: `new → verify → impl → revise`
