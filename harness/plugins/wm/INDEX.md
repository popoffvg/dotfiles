# wm — what is where

The single map of this plugin. No skill restates any row below; each one points here.

## The code flow — one router plus four workers

`/code` and the four skills it routes to. `code` and `review` are user-invocable; the other three
workers carry `user-invocable: false` and are reached through the router, or loaded by name by the
model. `review` is invocable on its own because judging a diff is a whole job that starts without a
spec — `/code review` stays as an alias so the flow still reads end to end.

| Skill | Invocable | Role |
|---|---|---|
| `code` | `/code <subcommand>` | **Routes.** Holds the subcommand table, the pipeline, and the shared taxonomy — nothing else. |
| `arch` | no | **Designs.** The spec corpus and the component taxonomy, before any code exists. |
| `impl` | no | **Writes source.** Every operation that changes source files or git history. |
| `review` | `/review <mode>` | **Judges how source is built** — rules, patterns, language idiom, correctness. Never whether it is the right thing; that is `code:sub-verify.md` and the `verifier` agent. Writes nothing but its reports. `/code review` is an alias for it. |
| `teach` | no | **Teaches.** Builds and measures the human's understanding of the code. |

Split by the kind of work, not by pipeline stage: a reader who knows the kind of work knows the skill.

## Citation convention

A **prefixed** path names the owner — `arch:ref-write.md`, `impl:sub-commit.md`, `review:ref-gates.md`,
`teach:sub-quiz.md`, `code:ref-jj-notes.md`, and `wm:` for the three files at the plugin root. A **bare** filename always
means a file in the citing skill. The prefix is the only thing that says which directory to open.

## The common layer — `wm:`

Four files at the plugin root, shared by all five skills.

| File | Owns |
|---|---|
| `wm:INDEX.md` | This map. |
| `wm:GLOSSARY.md` | **The leading words** — one word, one meaning, used verbatim by all five skills: the gate, thought, open question, target picture, wave, constraints, outcome, components, brick, increment, approve, blast radius, ledger, status, grill, trace, layer, verification chain, audit, drift, deviation, notes-dir, mutant, fixup. A word used in two skills is defined here once; a word private to one skill is defined there. |
| `wm:TOOLS.md` | **Situation → tool** — every script, agent, and skill the five skills reach for, grouped by the need it serves, with the invocation and what it returns. A procedure cites a row here instead of describing the step by hand. |
| `wm:CLAUDE.md` | How to work on this plugin — the rules a change to any skill obeys. |

## The file map

### `code` — routing and the shared taxonomy

| File | Owns |
|---|---|
| `SKILL.md` | The subcommand table (each row → the file that owns that procedure) and the pipeline. |
| `references/ref-subcommand-rules.md` | The rules every subcommand obeys, in any of the five skills — obey `RULES.md`, archive superseded thoughts, logging, commits, glossary currency, source read-only, confirm destructive git. |
| `references/ref-jj-notes.md` | The notes-dir jj history. |
| `commands/sub-verify.md` | `verify` — the adversarial read-only spec audit. READY / NEEDS REVISION. |
| `commands/sub-code-map.md` | `code-map` — the single-panel planned-architecture HTML, via `/dive explain`. |
| `commands/sub-diff.md` | `diff` — before/after architecture panels and signatures-as-diffs, as one HTML page. |

### `arch` — design

| File | Owns |
|---|---|
| `commands/sub-new.md` | `new` — the grill loop and its exit contract. Stops at the gate. |
| `commands/sub-todo.md` | `todo` — the `TODO-N.md` + `TODO-N.agent.md` pair and what each half holds; the wave fan-out (one fork per ledger row) and what only the caller may write; the TODO elements, the verification chain, the outcome rules, `## Surface` (the one diff, in the human half), the surface-not-a-body rule with its human-asked exception, and `## Constraints` (the fixed line in the agent half naming the generator, and the rules it prints). |
| `commands/sub-revise.md` | `revise` — reconcile review corrections or shipped drift from a delta manifest, touching only stale notes and spec sections. Notes-only. |
| `commands/sub-prototype.md` | `prototype` — settle an open decision with the smallest visible code diff. |
| `references/ref-bricks.md` | The **brick** roster — the closed set of component types, what each owns, its metric, its common structure. Typed in every `## Components` row and every `GLOSSARY.md` `Kind`. |
| `references/ref-write.md` | **The spec contract** — artifacts, notes-dir layout, the `status` metadata (spec phase + TODO lifecycle), the `approve` metadata (how much of `impl` the human reviews, at spec level and per TODO), the `where` metadata (which checkout `impl` writes into, same two levels), the gate, TODO ordering and **waves**, the Spec-Readiness Checklist. The single source; no other file restates it. |
| `references/ref-todo-sections.md` | What cuts across the pair's sections — the `i-have-adhd` rule every prose line of the human half obeys, where the generated rules come from (the `decision` note *is* the rule), the two doctrines that bound every diff (a diff carries the change and not what the change forces; a diff carries the surface and not a body), and how the increments reach the commit. What goes inside one heading is the `>` block under that heading in `examples/todo.md` and `examples/todo-agent.md`. |
| `references/ref-note-format.md` | Thought notes; the required `description` and how a reader finds a thought by it; the answered-question and supersede → `thoughts/archived/` moves, both automatic. |
| `examples/notes-claude.md` | The notes-dir `CLAUDE.md`. |
| `examples/rules.md` | The notes-dir `RULES.md` and its three init knobs — approval depth is not one of them; it is the `approve` key on `spec.md` and on each TODO. |
| `examples/glossary.md` | The notes-dir `GLOSSARY.md` — the project's ubiquitous language, one `#` entry per term carrying its definition, `Status`, `Kind`, the `Forbidden` aliases, and `Source`. Distinct from `wm:GLOSSARY.md`. |
| `examples/patterns.md` | The notes-dir `PATTERNS.md` — the implementation patterns and reference files the increments follow, out of `spec.md` so the spec stays human-only. |
| `examples/concepts.md` | The notes-dir `CONCEPTS.md` — app architecture, data flow, and the flow the work changes, drawn with the `show-me` skill. Out of `spec.md` because the diagrams are re-read while the ledger is shaped and the spec is budgeted at 200 lines. Written only when a picture changes a layer, a wave, or where a row splits. |
| `examples/spec.md` | The notes-dir `spec.md` — the filled artifact, with the rules for each section beside it: Description, Goal, What we're NOT doing, the ledger (`Layer` / `Outcome` / the `Today \| After` table / `Done when` / `Commit` / `Why`), and the Plan with its wave table. The contract around it is `arch:ref-write.md`. |
| `examples/note-{question,decision,fact,impl-decision}.md` | The four thought notes. |
| `examples/todo.md` | The TODO **human half** (`TODO-N.md`) — Outcome, New terms, Components, **Surface** (the one diff), Autotest, Commit, **Deviations** (written by `impl`, never by `todo`) — and the worked example of it, including the plain contract block a file that is all body carries instead of a diff. |
| `examples/todo-agent.md` | The TODO **agent half** (`TODO-N.agent.md`) — Constraints (the fixed line naming `wm-constraints.py`, never a rule), Changes (increments as Files + Surface + Do + Blast radius, no diff), Files, Pre-reads, Manual test, Definition of done — and the worked example of it, including the `Surface: none` + Behavior shape an increment uses when the deliverable is a whole body. |

`references/` holds the rules that apply across artifacts; `examples/` holds one file per artifact.
Every file in `examples/` is the finished artifact filled with real content, and it carries its own
rules inline: each `>` line states the rule for the block above it. Copy the file, replace the
content, delete the `>` lines.

### `impl` — writes source or git history

| File | Owns |
|---|---|
| `commands/sub-impl.md` | `impl` — execute one TODO, increment by increment; and the fork a user correction that contradicts the pair takes — `revise` or a recorded **deviation**. |
| `references/ref-change-types.md` | **The change-type roster** — the nine kinds a changed file's diff can be (`new behavior`, `signature change`, `wiring`, `call-site migration`, `rename`, `move`, `deletion`, `test`, `generated`), the typed list shown per increment under `approve: increment`, and the start point + main changes shown once under `approve: todo` and reported under `approve: none`. |
| `commands/sub-auto.md` | `auto` — the whole ledger unattended, gates replacing the human. |
| `commands/sub-fix.md` | `fix` — close a gap by fixing the thought, then the code. |
| `commands/sub-squash.md` | `squash` — distill the fixup trail into skills, squash the scope as one commit. |
| `commands/sub-commit.md` | `commit` — when to commit, one-commit-per-chunk, and § Fixups. Not the message text. |
| `examples/change-table.md` | The two change tables filled — the per-increment one and the whole-TODO one — each column and each required line carrying its own rules: the `What` grammar, the repo-relative `path:line` form, the closing blast-radius line, the marked start point, and the `the rest, counted` row. |

### `review` — judges source, writes none

| File | Owns |
|---|---|
| `SKILL.md` | The mode table — `diff` (the repo's own rules, the default) and `todo` (plus the pair's rule files) — the one question both ask, the read-only rule both obey, and the `/code review` alias. |
| `wm:commands/review:help.md` | The `/review:help` page — the same mode roster plus the gate table, printed verbatim. Mirrors `SKILL.md`; a mode change lands in both. |
| `references/ref-gates.md` | **The gate roster** — the seven gates, the `<notes-dir>/review/<target>/` report files each one writes, what each judges, its agent, its model tier and why that tier; the three test-reading gates (`test worth` drops the tests the diff wrote, `mutation` breaks the code to see whether the rest assert anything, `test` writes the one the diff left missing); the one-wave-then-the-gate-that-writes order, and the mutation gate's per-batch worktree fan-out; the FAIL-restarts-the-chain rule; the per-gate budget; the `toolchain.json` schema and what makes an entry stale; who merges the report. The single source; no caller restates a row. |
| `examples/report.md` | The two report files filled — one gate's own file and the merged `report.md` — each piece carrying its own rules: the `reviewed:` frontmatter, the fixed `## Covered` rows and their verdict enum, the one-line gate roll-up, and the finding line that ends in the edit that closes it. |
| `commands/sub-todo.md` | `review todo` — the chain over one implemented TODO, and what the pair gives a gate that a loose diff cannot: the generated rule set turning taste into a citable rule, `PATTERNS.md` naming the pattern, § Files bounding the diff, and the deviation route for an Autotest case `test-critic` drops. |
| `commands/sub-diff.md` | `review diff` — resolving a loose target into one revision range, deriving the intent sentence that gives the gates context, and which rule sources the standards gate falls back to with no generated rule set and no `PATTERNS.md`. |

### `teach` — the human's understanding

| File | Owns |
|---|---|
| `commands/sub-teach.md` | `teach` — the workspace, the mission gate, knowledge vs skills vs wisdom, lesson delivery. |
| `commands/sub-quiz.md` | `quiz` — the graded multiple-choice check. `teach` builds understanding, `quiz` measures it. |
| `examples/teach-mission.md` | `MISSION.md` — why the human is learning this code. |
| `examples/teach-resources.md` | `RESOURCES.md` — the trusted sources, the repo first. |
| `examples/teach-learning-record.md` | One learning record — what landed, and the level the next session starts at. |

## The other skills in this plugin

Independent of the `/code` flow, each with its own entry point.

| Skill | Invocable | Role |
|---|---|---|
| `dive` | `/dive <subcommand>` | Research before implementation. **Routes**, and owns the one rule every route's fan-out follows (§ Parallel subagents). The `workflow`, `unknowns`, `explain`, and `explain-diff` routes live in its `references/`. |
| `dive-docs` | no | The `docs` route, the default one. Fans out `explorer` to write one artifact per entry point and `explore-critic` to grade them, until research converges. `references/ref-artifact.md` is the contract both agents read. |
| `test-suite` | `/test-suite <subcommand>` | All testing work — strategy, scenario design, coverage audit, BDD, TDD. |
| `trace` | no | **Why an artifact is the way it is.** Spawns one `tracer` subagent that searches `thoughts/` from the artifact's own words and returns at most 8 chain rows plus a verdict — `live`, `superseded`, `unrecorded`. It replaces stored origin links: no file under `todos/` carries one. Loaded by `impl:sub-fix.md`, `arch:sub-revise.md`, and the `reviewer` gate. |
| `commit-message` | no | **The commit message contract** — the subject line and the three body parts: cause, goal, decision. Loaded by name before every commit written by `impl`, `auto`, `fix`, or `squash`. |
| `searchable-names` | no | **Choosing the name while the code is written** — one term per concept, the 2–4 word public name, one concept per file, the domain concept in a type, the whole string literal. Naming and module home for every piece; `arch:ref-bricks.md` adds only the metric and the structure. Loaded from `~/.claude/CLAUDE.md`, which keeps the comment prose. |
| `pedant` | no | **Attacking the names a finished diff already declares** — rejects the ones that read unclearly. The contract the `name-critic` gate reads. |
| `mutation` | no | **Judging a test set by breaking the code it covers** — one behavior-changing edit at a time, re-run the covering tests, report every mutant that survived as the assertion nobody wrote. Fans out one `mutation-tester` per changed-source batch, each in its own git worktree. No external mutation tool: the model writes the edit. The contract the `mutation` gate reads. |
| `red-green-refactor` | no | The failing-test-first cycle a bug fix follows. Loaded by `impl:sub-impl.md`. |

### `mutation` — the test set under attack

| File | Owns |
|---|---|
| `SKILL.md` | The four terms (**mutant**, killed, survived, equivalent), the five run steps — resolve the surface, batch it one per source file, pick worktree or in place, spawn the batch in one message, merge and rule — the baseline that makes a negative finding trustworthy, and the all-survived control. |
| `references/ref-operators.md` | **The operator roster** — the ten mutation operators in the order their survivors most often name a real gap, the one-edit-per-mutant and budget rules, the six equivalent-mutant rows, and what is never mutated. The `mutation-tester` agent's `## Covered` rows are these ten. |

### `test-suite` — the test artifacts

| File | Owns |
|---|---|
| `examples/strategy-auth-refresh.md` | The `.md` test set filled — the function block, the big cases with their variant lines, How it runs, Coverage, Not covered, Open questions — each piece carrying its own rules. The five cross-cutting rules and the pre-save checklist are `references/ref-readable-output.md`. |
| `examples/auth-refresh.feature.md` | The `.feature` file filled — the Feature header, `Background`, one `Rule` per big case with the hardest happy path first, the variant-name tags, the `"""sh` operator docstring — each piece carrying its own rules. The procedure is `references/sub-bdd.md`. |

The two examples are one corpus: the same `POST /auth/refresh` handler, mapped in the `.md` and
bodied in the `.feature`, joined by the variant names.

## Graded from outside — `evals/`

| File | Owns |
|---|---|
| `evals/run.sh` | The runner. Extracts the graded rule blocks from `arch:sub-todo.md` at run time — § One ledger row, two halves, § Surface, § Changes, § Autotest, § Constraints — so the suite always grades the current spec, never a copy of it. |
| `evals/cases-todo.jsonl` | The labelled cases. Two axes per case: **half** (`human` / `agent` / `corpus` — which file the content belongs in; the `## Constraints` line is agent, a rule's text and the reason behind it are both a `thoughts/` note) and **form** (`keep` / `reshape` — ships as written, or is a **body** that must become an Interface block plus a Behavior sketch). |
| `evals/run-names.sh` | The runner for the naming split. Extracts the `description:` block of `searchable-names` and of `pedant` from frontmatter at run time and shows the judge nothing else — the description is what decides which skill a session loads, so the description is what gets graded. |
| `evals/cases-searchable-names.jsonl` | The labelled tasks. One axis: **pick** (`searchable-names` / `pedant` / `none` — write-time naming, review-time naming, or neither). |
| `evals/README.md` | What each axis means, which cases are deliberately hard, and the last run's score. |

One `evals/` serves the whole plugin (`plugin-evals-at-plugin-root`); add `cases-<skill>.jsonl` beside
the existing suite rather than nesting an `evals/` inside a skill. A change to a graded rule's
*contract* — a new label, a new axis — updates the cases in the same commit.

## Outside this plugin

| Owner | Holds |
|---|---|
| `flow-sketch` skill | The TS-pseudocode notation a `## Changes` **Behavior** sketch follows, and the variant table that picks its shape from the change kind and the `main` component's brick. The ordered parts of each brick are `arch:ref-bricks.md`. |
| `lessons` skill | Lesson **content** — dependency order, the concept-per-step rule, alternatives and asymmetries. `teach` owns the workspace, not the pedagogy. |
| `thought` skill | The concept of a thought and its rules. `arch:ref-note-format.md` gives this corpus's format. |
