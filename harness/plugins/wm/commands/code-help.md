---
name: code-help
description: Show all /code subcommands with one-line descriptions.
---

Print the following table verbatim. No preamble, no commentary, no tool calls — output only the markdown below.

## `/code <subcommand>` — full list

| Subcommand | Does |
|---|---|
| `new` *(default)* | Spec pipeline: init the corpus (CLAUDE.md, RULES.md — asks the three rule questions plus the spec's `approve` depth — CONSTRAINTS.md, PATTERNS.md), write spec.md (if missing) → grill until no open question note is left in thoughts/ → compile the plan with its wave table → stop at the gate. Does not write TODO bodies — the human reviews the spec first. |
| `todo` | Author the self-contained `todos/TODO-N.md` + `TODO-N.agent.md` pair — human half (Outcome, Components, Surface — the one diff — Unit + E2E tests) and agent half (the `CONSTRAINTS.md` pointer + the increments described, no diff, unlimited length) — appending every settled decision it finds to CONSTRAINTS.md. From a reviewed spec.md + thoughts/; runs only past the gate. |
| `verify` | Audit a spec before implementation in a separate `spec-verifier` agent (sonnet, read-only) — hunts contradictions, missing parts, edge cases. READY / NEEDS REVISION. |
| `revise` | Fix spec.md / todos and change or add a thoughts/ note; settles the review phase (resets the spec `status` to review). Notes-only. |
| `quiz` | Test the human's understanding — build a multiple-choice quiz over the spec (`status` init/review) or the code changes (`status` impl), grade the answers, report a score. Read-only; edits no artifact. |
| `teach` | Teach the human this codebase step by step, across sessions. Stateful workspace `<notes-dir>/teach/` — MISSION.md, numbered HTML lessons, reference cheat sheets, learning records that set the level for the next session. Subject follows `status`: the code the change lands in (init/review) or the branch diff (impl); `/code teach <path-or-symbol>` targets one unit. Read-only over source. |
| `prototype` | Settle an open design decision with a small, visible demonstrative diff. |
| `code-map` | Produce a single-panel planned-architecture HTML map (package or component/type) for the spec — via `/dive explain`. |
| `diff` | Show what changed as one self-contained HTML page (opened): before/after architecture panels + interfaces/signatures rendered as diffs. `diff arch` *(default)* — current vs proposed architecture. `diff impl` — what the branch shipped, `git diff <target>...<current-branch>`. No mermaid. |
| `impl` | Execute one TODO — read context, replan guard, apply the increments and show them for approval as the spec's `approve` key asks, autotest, commit, report. `implementer` (sonnet, bg) writes + commits; the gate chain is `review`. |
| `auto` | Run the whole ledger unattended: arm the `/goal` Stop hook, then loop every open TODO through read `LESSONS.md` → implement → the review gate chain → `squash` the round's fixups → append `LESSONS.md` → `capture-lesson`, then the optional deploy, then verify the last TODO's E2E command. No per-increment approval. |
| `review` | Judge code without writing any: one haiku wave (lint, comments, names) in parallel, then the sonnet test gate, then the opus outcome gate. `review todo` judges an implemented TODO against its `TODO-N.md` + `TODO-N.agent.md` pair; `review diff` judges a loose diff, branch, PR, or working tree. Read-only — every finding routes back to a fixup. |
| `tree` | Worktree flow. `tree new` *(default)* — implement one TODO in its own `wt` worktree+branch, committing fixups as you go. `tree merge` — finish: invoke `squash`, then `wt merge` back. |
| `squash` | Analyze the fixup commits → distill lessons into skills (`capture-lesson`) → `git` squash the scope as one commit. Called by `tree merge` and by `auto` per TODO. |
| `fix` | Close a gap — bug, missing part, or adjustment. Mark the wrong/outdated note (or add a new one), write the corrected thought, fix code. |
| `commit` | When to commit and how a correction lands (fixups) — shared by `impl`, `tree`, `fix`. The message itself: the `commit-message` skill. |
| `help` | This page. |

Flow: `new → [human reviews spec] → todo → verify → impl → revise`
