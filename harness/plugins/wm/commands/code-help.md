---
name: code-help
description: Show all /code subcommands with one-line descriptions.
---

Print the following table verbatim. No preamble, no commentary, no tool calls — output only the markdown below.

## `/code <subcommand>` — full list

| Subcommand | Does |
|---|---|
| `new` *(default)* | Spec pipeline: write spec.md (if missing) → grill → produce thoughts/ → compile plan → stop at the gate. Does not write TODO bodies — the human reviews the spec first. |
| `todo` | Author `todos/TODO-N.md` bodies from a reviewed spec.md + thoughts/. Runs only past the gate. |
| `verify` | Audit a spec before implementation in a separate `spec-verifier` agent (sonnet, read-only) — hunts contradictions, missing parts, edge cases. READY / NEEDS REVISION. |
| `revise` | Fix spec.md / todos and change or add a thoughts/ note; settles the review phase (resets the spec `status` to review). Notes-only. |
| `prototype` | Settle an open design decision with a small, visible demonstrative diff. |
| `code-map` | Produce a single-panel planned-architecture HTML map (package or component/type) for the spec — via `/dive explain`. |
| `diff` | Show what changed as one self-contained HTML page (opened): before/after architecture panels + interfaces/signatures rendered as diffs. `diff arch` *(default)* — current vs proposed architecture. `diff impl` — what the branch shipped, `git diff <target>...<current-branch>`. No mermaid. |
| `impl` | Execute one TODO through the implement → lint → review loop: `implementer` (sonnet, bg) writes + commits, `lint-tester` (haiku) gates lint+tests, `reviewer` (opus) gates Outcome/correctness; each FAIL routes back to a fixup until both green. |
| `tree` | Worktree flow. `tree new` *(default)* — implement one TODO in its own `wt` worktree+branch, committing fixups as you go. `tree merge` — finish: invoke `squash`, then `wt merge` back. |
| `squash` | Analyze a worktree's fixup commits → distill lessons into `CLAUDE.local.md` → `git` squash-merge the branch as one commit. Called by `tree merge`. |
| `fix` | Close a gap — bug, missing part, or adjustment. Mark the wrong/outdated note (or add a new one), write the corrected thought, fix code. |
| `commit` | Git commit message conventions (`<prefix>: <why>`) — shared by `impl`, `tree`, `fix`. |
| `help` | This page. |

Flow: `new → [human reviews spec] → todo → verify → impl → revise`
