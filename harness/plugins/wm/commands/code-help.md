---
name: code-help
description: Show all /code subcommands with one-line descriptions.
---

Print the following table verbatim. No preamble, no commentary, no tool calls — output only the markdown below.

## `/code <subcommand>` — full list

| Subcommand | Does |
|---|---|
| `new` *(default)* | Spec pipeline: write spec.md (if missing) → grill loop → produce thoughts/ → compile plan → stop. Does NOT write TODOs — human reviews the spec first. |
| `todo` | Author `todos/TODO-N.md` bodies from an existing spec.md + thoughts/. Run only after human spec review. |
| `verify` | Audit a spec before implementation in a separate `spec-verifier` agent (sonnet, read-only) — hunts contradictions, missing parts, edge cases. READY / NEEDS REVISION. |
| `revise` | Fix spec.md / todos and change or add a thoughts/ note; settles the review phase (resets Status to review). Notes-only. |
| `prototype` | Settle an open design decision with a small, visible demonstrative diff. |
| `code-map` | Produce a D2 + SVG architecture map (package or component/type) for the spec. |
| `impl` | Execute one TODO — pick, read context, replan guard, implement, autotest, commit, report. |
| `tree` | Worktree flow. `tree new` *(default)* — implement one TODO in its own `wt` worktree+branch, committing fixups as you go. `tree merge` — finish: invoke `squash`, then `wt merge` back. |
| `squash` | Analyze a worktree's fixup commits → distill lessons into `CLAUDE.local.md` → `git` squash-merge the branch as one commit. Called by `tree merge`. |
| `fix` | Close a gap — bug, missing part, or adjustment. Mark the wrong/outdated note (or add a new one), write the corrected thought, fix code. |
| `commit` | Git commit message conventions (`<prefix>: <why>`) — shared by `impl`, `tree`, `fix`. |
| `help` | This page. |

Flow: `new → [human reviews spec] → todo → verify → impl → revise`
