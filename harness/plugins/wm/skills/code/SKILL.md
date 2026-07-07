---
name: code
description: >
  Manage spec writing, implementation, and bug fixing.
argument-hint: help
model-invocable: false
# Per-skill Stop hook: snapshot the notes jj repo when the session ends
# (see @references/ref-jj-notes.md). SessionStart init lives in the plugin's hooks.json.
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
> **Vocabulary**: @GLOSSARY.md — the leading words (the gate, thought, outcome, ledger, layer, trace, drift…) every reference below runs on. Read once; the words are used verbatim everywhere.
> **Notes history**: @references/ref-jj-notes.md — the notes-dir is its own jj repo; history is `jj log`.

`/code <subcommand>`. Pick the operation, read its reference, follow it. Default is `new`.

TODO comments in source belong to the user's request alone — write them only when asked.

## Subcommands

Reference-type slugs in the last column: **`sub`** subcommand contract · **`ref`** shared reference · **`tpl`** template · **`skill`** a model-invocable skill (load by name) · **`self`** this SKILL.

| `/code …` | You need to… | Reference |
|---|---|---|
| `new` *(default)* | Spec pipeline: write `spec.md` (if missing) → grill to empty Open Questions → produce `thoughts/` → compile plan → **stop at the gate**. Does not write TODO bodies. | `sub:new.md` · `ref:note-format.md` · `skill:flow-scetch` |
| `todo` | Author `todos/TODO-N.md` bodies from a reviewed `spec.md` + `thoughts/`. Runs only past the gate. | `sub:todo.md` · `tpl:todo.md` · `skill:flow-scetch` |
| `verify` | Audit the spec before impl in a separate read-only `spec-verifier` agent — contradictions, missing parts, edge cases, plus the completeness / test-honesty floor. Returns READY / NEEDS REVISION. | `sub:verify.md` |
| `revise` | Settle drift in `spec.md` / `todos/` and the `thoughts/` graph; resets `Status` to `review`. Notes-only. | `sub:revise.md` |
| `prototype` | Settle an OPEN decision with the smallest visible code diff — read the diff, not a report. | `sub:prototype.md` |
| `code-map` | D2 + SVG architecture map (package or component) as a visual aid. | `sub:code-map.md` |
| `diff` | Show change as one self-contained HTML page (opened): before/after arch panels + signatures-as-diffs. `diff arch` *(default)*: current vs proposed. `diff impl`: what the branch shipped. | `sub:diff.md` · `sub:code-map.md` |
| `impl` | Execute one TODO — read context, replan guard, implement, autotest, commit, report. | `sub:impl.md` |
| `squash` | Read the fixup trail → distill lessons into `CLAUDE.local.md` → squash-merge as one commit. Called by `tree merge`. | `sub:squash.md` |
| `fix` | Close a gap (bug / missing / adjust) by fixing the thought, then the code. Edits source. | `sub:fix.md` |
| `commit` | Commit-message conventions (`<prefix>: <why>`) — shared by `impl`, `tree`, `fix`. | `sub:commit.md` |
| `help` | This page. | `self:SKILL.md` |

Path by slug: `sub:` files live in `commands/`, `ref:`/`tpl:` in `references/`, `self` is this SKILL. Shared `ref` files not tied to one row: `ref:write.md` (spec contract, layout, Status, the gate — the single source), `ref:jj-notes.md`, `ref:subcommand-rules.md` (the rules every subcommand obeys — logging, commits, glossary, source read-only, confirm destructive git). TS-pseudocode `## Changes` lives in the `flow-scetch` skill (`skill:flow-scetch`), loaded on demand. Templates: `tpl:glossary.md`, `tpl:note-{decision,fact,impl-decision}.md`, `tpl:todo.md`.

## Pipeline

```
research → new → ┃ the gate ┃ → todo → verify → impl → revise (iterate)
                 ┗ human review ┛
```

The gate is a human read, not a command: `new` stops at a reviewable spec; the human runs `todo` when satisfied. `tree` is the worktree-isolated `impl`; `squash` collapses a `tree` branch's fixups. `revise` settles drift notes-only; `fix` corrects thought **and** code. `prototype`, `code-map`, `diff` are mid-spec aids.

<<<<<<< HEAD
The spec contract — layout, the `Status` header (`init → review → impl`), output shape, and the gate — lives in one place: `references/ref-write.md`. This router does not restate it.
||||||| parent of 9aa85a6 (35F69789-9B90-49C0-8D30-6954CCD964FF)
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
=======
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

`new`, `revise`, `todo`, `impl`, and `fix` all keep `<notes-dir>/GLOSSARY.md` current —
the ubiquitous-language dictionary, a sibling file of `spec.md` (template: `references/glossary-template.md`).
>>>>>>> 9aa85a6 (35F69789-9B90-49C0-8D30-6954CCD964FF)
