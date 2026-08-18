# wm — what is where

The single map of this plugin. No skill restates any row below; each one points here.

## The code flow — one router plus three workers

`/code` and the three skills it routes to. Only the router is user-invocable; the workers carry
`user-invocable: false` and are reached through it, or loaded by name by the model.

| Skill | Invocable | Role |
|---|---|---|
| `code` | `/code <subcommand>` | **Routes.** Holds the subcommand table, the pipeline, and the shared taxonomy — nothing else. |
| `arch` | no | **Designs.** The spec corpus and the component taxonomy, before any code exists. |
| `impl` | no | **Writes source.** Every operation that changes source files or git history. |
| `teach` | no | **Teaches.** Builds and measures the human's understanding of the code. |

Split by the kind of work, not by pipeline stage: a reader who knows the kind of work knows the skill.

## Citation convention

A **prefixed** path names the owner — `arch:ref-write.md`, `impl:sub-commit.md`, `teach:sub-quiz.md`,
`code:ref-jj-notes.md`, and `wm:` for the three files at the plugin root. A **bare** filename always
means a file in the citing skill. The prefix is the only thing that says which directory to open.

## The common layer — `wm:`

Three files at the plugin root, shared by all four skills.

| File | Owns |
|---|---|
| `wm:INDEX.md` | This map. |
| `wm:GLOSSARY.md` | **The leading words** — one word, one meaning, used verbatim by all four skills: the gate, thought, open question, target picture, wave, constraints, outcome, components, brick, increment, blast radius, ledger, status, grill, trace, layer, verification chain, audit, drift, notes-dir, fixup. A word used in two skills is defined here once; a word private to one skill is defined there. |
| `wm:CLAUDE.md` | How to work on this plugin — the rules a change to any skill obeys. |

## The file map

### `code` — routing and the shared taxonomy

| File | Owns |
|---|---|
| `SKILL.md` | The subcommand table (each row → the file that owns that procedure) and the pipeline. |
| `references/ref-subcommand-rules.md` | The rules every subcommand obeys, in any of the four skills — obey `RULES.md`, archive superseded thoughts, logging, commits, glossary currency, source read-only, confirm destructive git. |
| `references/ref-jj-notes.md` | The notes-dir jj history. |
| `commands/sub-verify.md` | `verify` — the adversarial read-only spec audit. READY / NEEDS REVISION. |
| `commands/sub-revise.md` | `revise` — settle drift in `spec.md`, `todos/`, and the thought graph. Notes-only. |
| `commands/sub-code-map.md` | `code-map` — the single-panel planned-architecture HTML, via `/dive explain`. |
| `commands/sub-diff.md` | `diff` — before/after architecture panels and signatures-as-diffs, as one HTML page. |

### `arch` — design

| File | Owns |
|---|---|
| `commands/sub-new.md` | `new` — the grill loop and its exit contract. Stops at the gate. |
| `commands/sub-todo.md` | `todo` — TODO elements, the verification chain, the outcome rules. |
| `commands/sub-prototype.md` | `prototype` — settle an open decision with the smallest visible code diff. |
| `references/ref-bricks.md` | The **brick** roster — the closed set of component types, what each owns, its metric, its common structure. Typed in every `## Components` row and every `GLOSSARY.md` `Kind`. |
| `references/ref-write.md` | **The spec contract** — artifacts, notes-dir layout, the `status` metadata (spec phase + TODO lifecycle), the gate, TODO ordering and **waves**, the Spec-Readiness Checklist. The single source; no other file restates it. |
| `references/ref-note-format.md` | Thought notes, and the supersede → `thoughts/archived/` move. |
| `references/tpl-notes-claude.md` | The notes-dir `CLAUDE.md`. |
| `references/tpl-rules.md` | The notes-dir `RULES.md` and its four init knobs. |
| `references/tpl-glossary.md` | The notes-dir `GLOSSARY.md` — the project's ubiquitous language, distinct from `wm:GLOSSARY.md`. |
| `references/tpl-note-{question,decision,fact,impl-decision}.md` | The four thought notes. |
| `references/tpl-todo.md` | The TODO body, and the worked example of it. |

Every `tpl-*.md` is the finished artifact filled with real content, carrying `>` lines that state the
rule for the block above them. Copy the file, replace the content, delete the `>` lines.

### `impl` — writes source or git history

| File | Owns |
|---|---|
| `commands/sub-impl.md` | `impl` — execute one TODO, increment by increment. |
| `commands/sub-auto.md` | `auto` — the whole ledger unattended, gates replacing the human. |
| `commands/sub-fix.md` | `fix` — close a gap by fixing the thought, then the code. |
| `commands/sub-squash.md` | `squash` — distill the fixup trail into lessons, squash-merge as one commit. |
| `commands/sub-commit.md` | `commit` — when to commit, one-commit-per-chunk, and § Fixups. Not the message text. |

### `teach` — the human's understanding

| File | Owns |
|---|---|
| `commands/sub-teach.md` | `teach` — the workspace, the mission gate, knowledge vs skills vs wisdom, lesson delivery. |
| `commands/sub-quiz.md` | `quiz` — the graded multiple-choice check. `teach` builds understanding, `quiz` measures it. |
| `references/tpl-teach-mission.md` | `MISSION.md` — why the human is learning this code. |
| `references/tpl-teach-resources.md` | `RESOURCES.md` — the trusted sources, the repo first. |
| `references/tpl-teach-learning-record.md` | One learning record — what landed, and the level the next session starts at. |

## The other skills in this plugin

Independent of the `/code` flow, each with its own entry point.

| Skill | Invocable | Role |
|---|---|---|
| `dive` | `/dive <subcommand>` | Research before implementation. **Routes**, and owns the one rule every route's fan-out follows (§ Parallel subagents). The `workflow`, `unknowns`, `explain`, and `explain-diff` routes live in its `references/`. |
| `dive-docs` | no | The `docs` route, the default one. Fans out `explorer` to write one artifact per entry point and `explore-critic` to grade them, until research converges. `references/ref-artifact.md` is the contract both agents read. |
| `test-suite` | `/test-suite <subcommand>` | All testing work — strategy, scenario design, coverage audit, BDD, TDD. |
| `commit-message` | no | **The commit message contract** — the subject line and the three body parts: cause, goal, decision. Loaded by name before every commit written by `impl`, `auto`, `fix`, or `squash`. |
| `pedant` | no | Attacks every name in the code and rejects the ones that read unclearly. |
| `red-green-refactor` | no | The failing-test-first cycle a bug fix follows. Loaded by `impl:sub-impl.md`. |

## Outside this plugin

| Owner | Holds |
|---|---|
| `flow-scetch` skill | The TS-pseudocode form a `## Changes` **Behavior** snippet follows, and the variant table that picks its shape. |
| `lessons` skill | Lesson **content** — dependency order, the concept-per-step rule, alternatives and asymmetries. `teach` owns the workspace, not the pedagogy. |
| `CODE_STYLE.md` § Domain module layout | Naming and module home for every piece. `arch:ref-bricks.md` adds only the metric and the structure. |
| `thought` skill | The concept of a thought and its rules. `arch:ref-note-format.md` gives this corpus's format. |
