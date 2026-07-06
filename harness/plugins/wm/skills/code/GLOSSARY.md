# Code skill — leading words

The vocabulary this skill's own text runs on. One word, one meaning, used verbatim across
`SKILL.md` and `references/`. Not the project's ubiquitous language — that lives in the
notes-dir `GLOSSARY.md` (template: `references/tpl-glossary.md`).

| Word | Meaning |
|------|---------|
| **the gate** | The human-review checkpoint between spec and TODOs. `new` produces a reviewable spec + thought graph and **stops**; a human reads it; only then `todo` authors bodies. Authoring TODOs before the gate turns a wrong spec into wrong code — the mistake the gate exists to prevent. |
| **thought** | A standalone note in `thoughts/` — `decision`, `fact`, or `impl-decision`. The atom of reasoning. The spec compiles from thoughts; every TODO traces back to them. Rule: fix the thought before the code, or the code drifts back. |
| **target picture** | `spec.md` — what the world looks like when the work is done. Description + Goal say what is true; Decisions + GLOSSARY.md let a human validate the model; the ledger enumerates the steps there. |
| **outcome** | A TODO's post-condition in use-case language — `<actor> can <capability>`, GLOSSARY.md terms only, no implementation nouns. The discussion object: the user aligns on outcomes at the gate before any body exists. |
| **ledger** | The TODO List in spec.md — an index of outcomes (`Layer \| Outcome \| Commit` rows), no bodies. |
| **grill** | The depth-first interview loop that drives Open Questions to empty. One question at a time, one thought per resolution, spec updated inline. |
| **trace** | (1) The one-sentence entry→exit path — the `// trace:` line opening a `flow`, which must match the TODO's Outcome. (2) The thought graph read backward (`Depends on`) and forward (`Affects`) from a decision to its why. |
| **layer (Ln)** | Call-sequence depth. TODOs land deepest-first: `L0` leaf (talks to the outside world) → `Lmax` wiring (`main.go`). A leaf commit compiles alone; upper layers never rewrite it. |
| **verification chain** | Type → Outcome → New terms → Changes → Autotest. A human approves a TODO by walking the chain top-down with the repo closed; each link is checked against the Outcome, the anchor. |
| **audit** | `verify` — adversarial, read-only, run in a separate `spec-verifier` agent that did not write the spec. Hunts contradictions, missing parts, edge cases. A finding without a reproducing scenario is a nit, not a blocker. |
| **drift** | Divergence between two things that should match: shipped code vs its spec (`revise` settles it), or a stale doc vs reality (sediment — fix in place). |
| **notes-dir** | `<notes-dir>` (commonly `.notes/`) — the wm notes directory, its own jj repo, git-ignored in the parent. Resolve it from the active phase; never hardcode `_notes/` or `.notes/`. |
| **fixup** | `git commit --fixup=<sha>` recording a user correction. The fixup trail is what `squash` reads to distill lessons; a correction folded into a normal commit is a lost lesson. |
