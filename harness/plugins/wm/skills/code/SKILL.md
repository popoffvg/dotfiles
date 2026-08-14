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
> **Map**: @../../INDEX.md — which of the four skills owns which file, and what that file owns. This router restates none of it.
> **Vocabulary**: @../../GLOSSARY.md — the leading words (the gate, thought, open question, outcome, ledger, layer, wave, constraints, trace, drift…) every reference below runs on. Read once; the words are used verbatim everywhere.
> **Notes history**: @references/ref-jj-notes.md — the notes-dir is its own jj repo; history is `jj log`.

`/code <subcommand>`. Pick the operation, read its reference, follow it. Default is `new`.

TODO comments in source belong to the user's request alone — write them only when asked.

## Subcommands

Reference-type slugs in the last column name the skill that owns the file: **`sub:`** this skill's `commands/` · **`arch:`** the `arch` skill (design — the spec corpus and the brick roster) · **`impl:`** the `impl` skill (writes source or git history) · **`teach:`** the `teach` skill (the human's understanding) · **`ref`** a shared reference here · **`skill`** a model-invocable skill, loaded by name · **`self`** this SKILL.

| `/code …` | You need to… | Reference |
|---|---|---|
| `new` *(default)* | Spec pipeline: init the corpus (`CLAUDE.md`, `RULES.md` — ask the four rule questions), write `spec.md` (if missing) → grill until no open question note is left in `thoughts/` → compile the plan with its **wave** table → **stop at the gate**. Does not write TODO bodies. | `arch:sub-new.md` · `skill:flow-scetch` |
| `todo` | Author self-contained `todos/TODO-N.md` bodies (restated Constraints, Unit **and** E2E tests) from a reviewed `spec.md` + `thoughts/`. Runs only past the gate. | `arch:sub-todo.md` · `skill:flow-scetch` |
| `verify` | Audit the spec before impl in a separate read-only `spec-verifier` agent — contradictions, missing parts, edge cases, plus the completeness / test-honesty floor. Returns READY / NEEDS REVISION. | `sub:verify.md` |
| `revise` | Settle drift in `spec.md` / `todos/` and the `thoughts/` graph; resets the spec `status` to `review`. Notes-only. | `sub:revise.md` |
| `quiz` | Test **the human's** understanding: build a multiple-choice quiz — over the spec (`status` `init`/`review`) or the code changes (`status` `impl`) — grade the answers, report a score. Read-only; edits no artifact. | `teach:sub-quiz.md` |
| `teach` | Build **the human's** understanding of the codebase and the branch change, step by step across sessions. Stateful workspace `<notes-dir>/teach/` — mission, HTML lessons, reference sheets, learning records. Read-only over source. | `teach:sub-teach.md` · `skill:lessons` |
| `prototype` | Settle an OPEN decision with the smallest visible code diff — read the diff, not a report. | `arch:sub-prototype.md` |
| `code-map` | Single-panel planned-architecture HTML map (package or component) as a visual aid — via `/dive explain`. | `sub:code-map.md` |
| `diff` | Show change as one self-contained HTML page (opened): before/after arch panels + signatures-as-diffs. `diff arch` *(default)*: current vs proposed. `diff impl`: what the branch shipped. | `sub:diff.md` · `sub:code-map.md` |
| `impl` | Execute one TODO — read context, replan guard, apply each increment for user approval, autotest, commit, report. | `impl:sub-impl.md` |
| `auto` | Unattended run of the whole ledger: arm the `/goal` Stop hook → per TODO (read `LESSONS.md` → impl → `lint-tester` → `reviewer` → `tester` gates → append `LESSONS.md`) → optional deploy → verify E2E. No per-increment approval. | `impl:sub-auto.md` · `impl:sub-impl.md` · `skill:carry-review-findings-in-a-lessons-file` |
| `squash` | Read the fixup trail → distill lessons into `CLAUDE.local.md` → squash-merge as one commit. Called by `tree merge`. | `impl:sub-squash.md` |
| `fix` | Close a gap (bug / missing / adjust) by fixing the thought, then the code. Edits source. | `impl:sub-fix.md` |
| `commit` | When to commit and how a correction lands (fixups) — shared by `impl`, `tree`, `fix`. The message itself: the `commit-message` skill. | `impl:sub-commit.md` · `skill:commit-message` |
| `help` | This page. | `self:SKILL.md` |

Path by slug: `sub:` files live in this skill's `commands/`; `arch:`, `impl:`, and `teach:` in that skill's `commands/` or `references/`; `ref:` in this skill's `references/`; `self` is this SKILL.

## Pipeline

```
research → new → ┃ the gate ┃ → todo → verify → impl → revise (iterate)
                 ┗ human review ┛
```

The gate is a human read, not a command: `new` stops at a reviewable spec; the human runs `todo` when satisfied. `auto` is `impl` looped over the whole ledger with the gates replacing the human, then deploy + E2E. `tree` is the worktree-isolated `impl`; `squash` collapses a `tree` branch's fixups. `revise` settles drift notes-only; `fix` corrects thought **and** code. `prototype`, `code-map`, `diff` are mid-spec aids.

The spec contract — layout, the `status` metadata (spec phase `init → review → impl`; TODO lifecycle `todo → impl → verify → done`, both in YAML frontmatter), output shape, and the gate — lives in one place: `arch:ref-write.md`. This router does not restate it.
