---
name: code
description: >
  One entry point for spec writing, implementation, and bug fixing. Default is new
  (write spec → grill loop → produce notes → compile plan → stop; does NOT write TODOs).
  Other subcommands: todo (author TODO bodies after human spec review), verify (audit),
  revise (sync to shipped), prototype (settle a decision),
  code-map (diagram), diff (arch: current vs proposed / impl: branch-vs-target changes),
  impl (execute one TODO), tree (worktree-per-TODO: new/merge),
  squash (analyze fixups → CLAUDE.local.md → git squash), fix (correct a bug, missing
  part, or implementation adjustment by fixing the thought then the code),
  commit (commit-message conventions), help (this page).
  Invoke as /code <subcommand>.
argument-hint: help
# Per-skill Stop hook: snapshot the notes jj repo when the session ends
# (see @references/jj-notes.md). SessionStart init lives in the plugin's hooks.json.
hooks:
  Stop:
    - matcher: ""
      hooks:
        - type: command
          command: ${CLAUDE_PLUGIN_ROOT}/bin/notes-jj-commit.sh
          timeout: 5000
---

# Code — subcommand router

> **Read first**: @workflow — pipeline, agents contract, notes structure, hard rules.
> **Notes history**: @references/jj-notes.md — the notes dir is its own jj repo (SessionStart inits it, Stop commits it); spec history is `jj log`. No worklog.md.

**NEVER write TODO comments in code** unless the user explicitly asks for them.

`/code <subcommand>`. Pick the operation, read its reference, follow it. Default is `new`.

## Subcommands

| `/code …` | You need to… | Reference |
|---|---|---|
| `new` *(default)* | Spec pipeline: write `spec.md` (if missing) → grill loop (ask→answer→note) → produce `thoughts/` → compile plan → **stop**. Does NOT write TODO bodies — the human reviews the spec first. | `references/new.md` · `references/note-format.md` · `references/flow.md` |
| `todo` | Author `todos/TODO-N.md` bodies from an existing `spec.md` + `thoughts/`. Run only after the human has manually reviewed the spec. | `references/todo.md` · `references/todo-template.md` · `references/flow.md` |
| `verify` | Audit spec before implementation in a **separate `spec-verifier` agent** (sonnet, read-only) — hunts contradictions, missing parts, edge cases; also runs the completeness / test-honesty floor. Returns READY / NEEDS REVISION. | `references/verify.md` |
| `revise` | Fix `spec.md` / `todos/TODO-N.md` and change or add a `thoughts/` note; the settle action of the review phase — resets `Status` to `review`. Notes-only, no source edits. | `references/revise.md` |
| `prototype` | Settle an OPEN design decision by spawning the implementer to make small, visible code changes. | `references/prototype.md` |
| `code-map` | Produce a D2 + SVG architecture map (package or component/type map) as visual aid. | `references/code-map.md` |
| `diff` | Show what changed as one self-contained HTML page (opened): before/after architecture panels + interfaces/signatures rendered as diffs. `diff arch` *(default)*: current vs proposed architecture. `diff impl`: what the branch shipped, `git diff <target>...<current-branch>`. No mermaid. | `references/diff.md` · `references/code-map.md` |
| `impl` | Execute one TODO — read context, replan guard, implement, autotest, commit, report. | `references/impl.md` |
| `tree` | Worktree flow. `tree new` *(default)*: implement one TODO in its own `wt` worktree+branch, committing fixups as you go. `tree merge`: invoke `squash`, then `wt merge` back. | `references/tree.md` |
| `squash` | Analyze the worktree's fixup commits → distill lessons into `CLAUDE.local.md` → `git` squash-merge the branch as one commit. Called by `tree merge`. | `references/squash.md` |
| `fix` | Close a gap — bug, missing part, or adjustment. Mark the wrong/outdated note (or add a new one), write the corrected thought, fix code. | `references/fix.md` |
| `commit` | Git commit-message conventions (`<prefix>: <why>`) — shared by `impl`, `tree`, `fix`. | `references/commit.md` |
| `help` | This page — list all subcommands with descriptions. | (self) |

Internal reference: `references/flow.md` — TS pseudocode patterns for `## Changes`. Used by `new`.

## How they combine

```
research → new → [human reviews spec] → todo → verify → impl → revise (iterate)
```

- **new** is the default. It writes `spec.md` (if missing), runs the grill loop to empty
  Open Questions, produces the `thoughts/` thought graph, compiles the plan, and **stops**.
  It does NOT write TODO bodies — the human reviews the spec before any TODO exists.
- **[human reviews spec]** is a manual gate, not a command. The human reads the spec + decision
  trail and, when satisfied, runs `todo`. This is the guard against authoring TODOs from an
  unreviewed spec.
- **todo** authors the TODO bodies from the reviewed `spec.md` + `thoughts/`. Also use it to
  rewrite stale TODOs. It refuses to run while Open Questions is non-empty.
- **verify** is the static audit gate over spec + TODOs. A spec with open questions cannot
  pass verify; run `new` again if the audit fails.
- **impl** executes one TODO end-to-end.
- **tree** is the worktree variant of impl: `tree new` isolates one TODO in a `wt`
  worktree+branch (commit fixups freely); `tree merge` runs `squash`, then `wt merge`.
- **squash** analyzes the worktree's fixup commits, distills lessons into `CLAUDE.local.md`,
  and `git` squash-merges the branch as one commit (invoked by `tree merge`).
- **commit** holds the shared commit-message conventions used by `impl`, `tree`, `fix`.
- **fix** closes a gap — a bug, a missing part, or an implementation adjustment — by correcting the thought, then the code (edits source).
- **prototype** and **code-map** are aids invoked mid-spec.
- **diff** shows change as one opened HTML page — before/after architecture panels + signatures-as-diffs. `diff arch` maps current vs proposed architecture; `diff impl` reports what the branch shipped against its target (`git diff`). Read-only.
- **revise** is the settle action of the review phase — fixes `spec.md` / `todos/` and changes or adds a `thoughts/` note, whether the trigger is a review-phase correction or post-impl divergence. Notes-only (use `fix` when the code must change too). Any revise resets `Status` to `review`.
- **help** shows this page.

## Spec status

`spec.md` carries a header `Status` field: `init → review → impl`. `new` seeds `init` and
advances to `review` when the spec is authored; `todo` runs only in `review`; `impl` advances to
`impl`; `revise` resets to `review`. The header's first line tells any reader what the spec
delivers; its phase-rules block states what each phase permits. See `references/write.md` § spec.md template.

## Output shape

`new` edits `<notes-dir>/spec.md` and produces `<notes-dir>/thoughts/NNN-{decision,fact,impl-decision}-slug.md`
(format: `references/note-format.md`). It does NOT write `todos/`.
`todo` writes `<notes-dir>/todos/TODO-N.md`. `revise` edits `<notes-dir>/spec.md` and `todos/TODO-N.md`.
`verify` writes `<notes-dir>/spec-verify.md`.
`fix` writes `<notes-dir>/thoughts/NNN-*-slug.md` (corrected thoughts).
All write only under `<notes-dir>/` — never touch source code.

`new`, `small`, `revise`, `todo`, `impl`, and `fix` all keep `<notes-dir>/GLOSSARY.md` current —
the ubiquitous-language dictionary, a sibling file of `spec.md` (template: `references/glossary-template.md`).
