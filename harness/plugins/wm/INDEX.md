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

Three files at the plugin root, shared by all five skills.

| File | Owns |
|---|---|
| `wm:INDEX.md` | This map. |
| `wm:GLOSSARY.md` | **The leading words** — one word, one meaning, used verbatim by all five skills: the gate, thought, open question, target picture, wave, constraints, outcome, components, brick, increment, approve, blast radius, ledger, status, grill, trace, layer, verification chain, audit, drift, deviation, notes-dir, fixup. A word used in two skills is defined here once; a word private to one skill is defined there. |
| `wm:CLAUDE.md` | How to work on this plugin — the rules a change to any skill obeys. |

## The file map

### `code` — routing and the shared taxonomy

| File | Owns |
|---|---|
| `SKILL.md` | The subcommand table (each row → the file that owns that procedure) and the pipeline. |
| `references/ref-subcommand-rules.md` | The rules every subcommand obeys, in any of the five skills — obey `RULES.md`, archive superseded thoughts, logging, commits, glossary currency, source read-only, confirm destructive git. |
| `references/ref-jj-notes.md` | The notes-dir jj history. |
| `commands/sub-verify.md` | `verify` — the adversarial read-only spec audit. READY / NEEDS REVISION. |
| `commands/sub-revise.md` | `revise` — settle drift in `spec.md`, `todos/`, and the thought graph. Notes-only. |
| `commands/sub-code-map.md` | `code-map` — the single-panel planned-architecture HTML, via `/dive explain`. |
| `commands/sub-diff.md` | `diff` — before/after architecture panels and signatures-as-diffs, as one HTML page. |

### `arch` — design

| File | Owns |
|---|---|
| `commands/sub-new.md` | `new` — the grill loop and its exit contract. Stops at the gate. |
| `commands/sub-todo.md` | `todo` — the `TODO-N.md` + `TODO-N.agent.md` pair and what each half holds; the wave fan-out (one fork per ledger row) and what only the caller may write; the TODO elements, the verification chain, the outcome rules, `## Surface` (the one diff, in the human half), the surface-not-a-body rule with its human-asked exception, and `## Constraints` (the fixed line in the agent half naming the generator, and the rules it prints). |
| `commands/sub-prototype.md` | `prototype` — settle an open decision with the smallest visible code diff. |
| `references/ref-bricks.md` | The **brick** roster — the closed set of component types, what each owns, its metric, its common structure. Typed in every `## Components` row and every `GLOSSARY.md` `Kind`. |
| `references/ref-write.md` | **The spec contract** — artifacts, notes-dir layout, the `status` metadata (spec phase + TODO lifecycle), the `approve` metadata (how much of `impl` the human reviews, at spec level and per TODO), the gate, TODO ordering and **waves**, the Spec-Readiness Checklist. The single source; no other file restates it. |
| `references/ref-todo-sections.md` | What goes inside each heading of the pair — one entry per section, frontmatter keys first: `status`, `type`, `depends_on`, `risk`, Outcome, New terms, Constraints (the fixed line naming the generator), Components, Surface with the surface-not-a-body rule, Changes, Autotest, Commit, Deviations, Manual test, Definition of done. Split out of `sub-todo.md` so the wave caller does not load it. |
| `references/ref-note-format.md` | Thought notes; the required `description` and how a reader finds a thought by it; the answered-question and supersede → `thoughts/archived/` moves, both automatic. |
| `examples/notes-claude.md` | The notes-dir `CLAUDE.md`. |
| `examples/rules.md` | The notes-dir `RULES.md` and its three init knobs — approval depth is not one of them; it is the `approve` key on `spec.md` and on each TODO. |
| `examples/constraints.md` | The **generated** rule set — the worked example of what `~/.claude/scripts/wm-constraints.py` prints, which notes it draws each row from, and what each column holds. **Nobody writes this file**; it shows a reader what the implementer and the reviewer see. |
| `examples/glossary.md` | The notes-dir `GLOSSARY.md` — the project's ubiquitous language, distinct from `wm:GLOSSARY.md`. |
| `examples/patterns.md` | The notes-dir `PATTERNS.md` — the implementation patterns and reference files the increments follow, out of `spec.md` so the spec stays human-only. |
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

### `review` — judges source, writes none

| File | Owns |
|---|---|
| `SKILL.md` | The mode table — `diff` (the repo's own rules, the default) and `todo` (plus the pair's rule files) — the one question both ask, the read-only rule both obey, and the `/code review` alias. |
| `wm:commands/review:help.md` | The `/review:help` page — the same mode roster plus the gate table, printed verbatim. Mirrors `SKILL.md`; a mode change lands in both. |
| `references/ref-gates.md` | **The gate roster** — the six gates, the `<notes-dir>/review/<target>/` report files each one writes, what each judges, its agent, its model tier and why that tier; the two opposite test gates (`test worth` drops the tests the diff wrote, `test` writes the one it left missing); the one-wave-then-two-serial order; the FAIL-restarts-the-chain rule; the per-gate budget; the merged report shape. The single source; no caller restates a row. |
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
| `trace` | no | **Why an artifact is the way it is.** Spawns one `tracer` subagent that searches `thoughts/` from the artifact's own words and returns at most 8 chain rows plus a verdict — `live`, `superseded`, `unrecorded`. It replaces stored origin links: no file under `todos/` carries one. Loaded by `impl:sub-fix.md`, `code:sub-revise.md`, and the `reviewer` gate. |
| `commit-message` | no | **The commit message contract** — the subject line and the three body parts: cause, goal, decision. Loaded by name before every commit written by `impl`, `auto`, `fix`, or `squash`. |
| `searchable-names` | no | **Choosing the name while the code is written** — one term per concept, the 2–4 word public name, one concept per file, the domain concept in a type, the whole string literal. Naming and module home for every piece; `arch:ref-bricks.md` adds only the metric and the structure. Loaded from `CODE_STYLE.md`, which keeps the comment prose. |
| `pedant` | no | **Attacking the names a finished diff already declares** — rejects the ones that read unclearly. The contract the `name-critic` gate reads. |
| `red-green-refactor` | no | The failing-test-first cycle a bug fix follows. Loaded by `impl:sub-impl.md`. |

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
| `flow-scetch` skill | The TS-pseudocode form a `## Changes` **Behavior** snippet follows, and the variant table that picks its shape. |
| `lessons` skill | Lesson **content** — dependency order, the concept-per-step rule, alternatives and asymmetries. `teach` owns the workspace, not the pedagogy. |
| `thought` skill | The concept of a thought and its rules. `arch:ref-note-format.md` gives this corpus's format. |
