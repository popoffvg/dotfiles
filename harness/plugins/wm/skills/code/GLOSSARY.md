# Code skill — leading words

The vocabulary this skill's own text runs on. One word, one meaning, used verbatim across
`SKILL.md` and `references/`. Not the project's ubiquitous language — that lives in the
notes-dir `GLOSSARY.md` (template: `references/tpl-glossary.md`).

| Word | Meaning |
|------|---------|
| **the gate** | The human-review checkpoint between spec and TODOs. `new` produces a reviewable spec + thought graph and **stops**; a human reads it; only then `todo` authors bodies. Authoring TODOs before the gate turns a wrong spec into wrong code — the mistake the gate exists to prevent. |
| **thought** | The atom of reasoning — one recorded decision/fact with its why (concept + rules: the `thought` skill). Here it is a standalone note in `thoughts/` — `question`, `decision`, `fact`, or `impl-decision` (format: `ref-note-format.md`). The spec compiles from thoughts; every TODO traces back to them. Rule: fix the thought before the code, or the code drifts back. |
| **open question** | An unresolved thought — `thoughts/NNN-question-*.md` with `status: open`. Never a `spec.md` section. It blocks readiness until it is flipped in place into a `decision` or `fact` note (same id, renamed file). List them: `~/.claude/scripts/wm-open-questions.sh`. |
| **target picture** | `spec.md` — what the world looks like when the work is done. Description + Goal say what is true; `thoughts/` + GLOSSARY.md let a human validate the model; the ledger enumerates the steps there and the Plan groups them into waves. |
| **wave** | A set of TODOs runnable at once: no `depends_on` edge between them and disjoint **Files** sets. The `## Plan` wave table is the execution order; `Ln` layers only prove the edges are legal. Widest wave first — a one-TODO-per-wave chain is a serialized spec. |
| **constraints** | A TODO's `## Constraints` table — every settled decision it obeys, restated in full, one row per decision. It exists so the TODO is self-contained: the implementer never opens `spec.md` or a note. |
| **outcome** | A TODO's post-condition in use-case language — `<actor> can <capability>`, GLOSSARY.md terms only, no implementation nouns. The discussion object: the user aligns on outcomes at the gate before any body exists. |
| **components** | A TODO's `## Components` table — the `package.Class` symbols it touches, exactly one marked `main` (the one carrying the Outcome's behavior). It is the map `## Changes` walks: every row is named by at least one **increment**. Symbols, not paths — paths live in **Files**. |
| **increment** | One entry in a TODO's `## Changes` sequence — the smallest diff worth approving on its own, with its own **Files**, predicted **blast radius**, and unified diff (≤ 25 changed lines). Increments are ordered deepest-first so the repo builds after each. They split the *review*, not the deliverable: increment 1 creates the commit and each later approved increment is appended to that same commit. A rejected increment stops the TODO. |
| **blast radius** | The **predicted** reach of a mistake — the symbols, callers, and consumers it forces you to retest. Scored 1–5 per TODO (frontmatter `risk`) and named per **increment** (the concrete symbols). Reach, never effort: a one-line edit to a shared type outreaches a large isolated module. |
| **ledger** | The TODO List in spec.md — an index of outcomes (`Layer \| Outcome \| Commit` rows), no bodies. |
| **status** | The lifecycle phase carried in YAML frontmatter — never body prose. Two machines: the spec's `init → review → impl` (`spec.md`) and each TODO's `todo → impl → verify → done` (`blocked` off the path). The single source is `ref-write.md` § Status. |
| **grill** | The depth-first interview loop that drives the open questions to zero. One question at a time; each resolution flips that question note into a decision/fact note; spec updated inline. |
| **trace** | (1) The one-sentence entry→exit path — the `// trace:` line opening a `flow`, which must match the TODO's Outcome. (2) The thought graph read backward (`Depends on`) and forward (`Affects`) from a decision to its why. |
| **layer (Ln)** | Call-sequence depth. TODOs land deepest-first: `L0` leaf (talks to the outside world) → `Lmax` wiring (`main.go`). A leaf commit compiles alone; upper layers never rewrite it. |
| **verification chain** | Type → Outcome → New terms → Constraints → Components → Changes → Autotest. A human approves a TODO by walking the chain top-down with the repo closed; each link is checked against the Outcome, the anchor. At `Changes` the walk goes increment by increment — one small diff per approval. |
| **audit** | `verify` — adversarial, read-only, run in a separate `spec-verifier` agent that did not write the spec. Hunts contradictions, missing parts, edge cases. A finding without a reproducing scenario is a nit, not a blocker. |
| **drift** | Divergence between two things that should match: shipped code vs its spec (`revise` settles it), or a stale doc vs reality (sediment — fix in place). |
| **notes-dir** | `<notes-dir>` (commonly `.notes/`) — the wm notes directory, its own jj repo, git-ignored in the parent. Resolve it from the active phase; never hardcode `_notes/` or `.notes/`. |
| **fixup** | `git commit --fixup=<sha>` recording a user correction. The fixup trail is what `squash` reads to distill lessons; a correction folded into a normal commit is a lost lesson. |
