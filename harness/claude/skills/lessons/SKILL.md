---
name: lessons
description: This skill should be used when the user asks to "create lessons", "teach me this project", "explain it concept by concept", "term by term", "like a professor presentation", "make a course from this spec", "I'm a newcomer to X, help me study it", "build a study guide", or "create a quiz so I can verify my understanding". Turns a document corpus (spec, project folder, codebase area, docs set) into a dependency-ordered lesson series and an optional self-scoring quiz, published as Artifacts.
argument-hint: [path to the corpus, and optionally "quiz" / "lessons only"]
---

# Lessons — Teach a Corpus, Then Test It

Turn a body of existing material into a course a newcomer can actually learn from: a dependency-ordered lesson series, and an optional quiz that verifies understanding rather than recall. Both ship as published Artifacts.

The output is **derived, never invented**. Every definition, threshold, and rationale traces to the corpus. The skill's value is *ordering, framing, and interrogating* material the reader already owns but cannot yet absorb.

## When this applies

Use for: a spec/project folder, a docs set, a subsystem of a codebase, a decision corpus — where the user is new to the domain and the material assumes fluency they lack.

Do not use for: teaching a general topic from world knowledge (no corpus to ground in), or a plain summary request ("what does this project do?" — answer that directly).

## Step 1 — Read the whole corpus, not its front door

Inventory every file and its size before reading. Then read the canonical sources in full.

Layered corpora are the norm and the trap. A project may hold a reader-facing render (`README.md`), a decisions render, an implementation render, a glossary, plus per-unit source files (spec atoms, ADRs, RFCs) and the evidence they were derived from. Renders often duplicate each other verbatim.

- Read the **renders** for framing and audience-appropriate prose — they are already pitched at a reader.
- Read the **source units** for detail the renders compress, and for `status:` / `version:` metadata that reveals what is settled versus in flux.
- Skim **open questions / TODO / STATUS** files. Unresolved items must be taught as unresolved.
- Never build lessons from one summary file. A summary is a lossy projection; teaching from it produces confident-wrong mechanics.

Identify, before writing: the **audience's starting point** (what the user says they don't know), the **terminal capability** (what they should be able to do — usually "read the primary doc unaided"), and the corpus's own **self-check material** if any exists (a "before you start" section, review questions, an FAQ). Reuse that material — it is the authors' own statement of what matters.

## Step 2 — Order the terms by dependency

Build a term graph, then linearize it. Each lesson introduces only vocabulary its successors need, and uses only vocabulary its predecessors established. Forward references are the primary defect to hunt for.

Open with the **problem, not the vocabulary**: one lesson that states what goes wrong in the world and why the subject exists. End it by naming the two or three phrases in that statement that the rest of the course exists to unpack. This gives every later lesson somewhere to attach.

Sequence the middle by dependency, not by the corpus's own file order — document order serves reference, not learning. A typical arc: domain objects → how they are addressed/indexed → the properties at stake → the mechanism → the decision logic layered on the mechanism → the output contract → the surrounding platform vocabulary → scope and phasing.

Close with boundaries: what is explicitly out of scope, and why each exclusion was chosen. Out-of-scope lists teach the design's shape better than feature lists do.

See `references/curriculum.md` for lesson anatomy, the four content types worth including, and the numbering rule.

## Step 3 — Write lessons that produce conclusions

For every term, go past the definition to its **operational consequence** — what it licenses, forbids, or explains elsewhere in the system. A definition the reader cannot act on has not been taught.

Prioritize, in this order:

1. **Consequences** — "a liability is a 1–3 residue motif" ⇒ "so the editable set is the whole span, and you get two shots at a fix."
2. **Traps** — plausible-sounding claims the corpus explicitly refutes. These are the highest-value content in any corpus; they mark where the authors expected a reader to go wrong. Quote the refutation and its reasoning.
3. **Rejected alternatives** — why a decision went the other way. A reversed decision teaches the constraint that reversed it.
4. **Asymmetries** — where the design treats two similar things differently (mean here, worst there; hard filter here, soft signal there). Name the asymmetry, then explain the principle behind it. These are where real understanding lives.

Mark unresolved items as unresolved, with the corpus's own wording. Never smooth an open question into a decision.

## Step 4 — Build the quiz (when asked, or offer it)

A quiz that asks for definitions verifies nothing. Every question either hands the reader a **case to resolve** or a **claim to judge**.

Question archetypes, mixed across the paper:

- **Judge the claim** — state a plausible thing a colleague would say; ask what is wrong with it.
- **Work the case** — supply concrete values and ask what the system does. Force use of real thresholds and defaults.
- **Compute and read** — make the reader apply an aggregation rule, then notice why that rule exists.
- **Trace the consequence** — "clearing motif A creates motif B; what happens?" Rewards knowing the constraint, not the happy path.
- **Name the reason, not the rule** — give a correct answer and three distractors that are *true but not the reason*. This separates recall from understanding more sharply than anything else.
- **Reconcile the tension** — point at two rules that appear to contradict and ask for the principle that resolves them.
- **Reconstruct from a constraint** — an open question: "given only this one limitation, derive the design." The best single question in any quiz.

Every answer reveals an explanation that **teaches** — including for correct answers, where it should add the fact the question implied but did not state.

See `references/quiz.md` for worked examples of each archetype, distractor construction, and scoring conventions.

## Step 5 — Publish as Artifacts

Load the `artifact-design` skill before writing markup, and follow it. Then:

- Write the HTML to the session scratchpad, publish with `Artifact`, and report the URL.
- Two deliverables ⇒ two artifacts, with distinct favicons and one shared visual identity (same tokens, same type pairing). Coherence across the pair reads as one course; a second unrelated design reads as a second project.
- For the quiz, copy `assets/quiz-scaffold.html` — it carries the option/verdict markup, the scoring bar, and the reveal script, so that boilerplate is never re-derived.
- Keep the lesson page a **document** (syllabus rail, reading column, term blocks) and the quiz an **instrument** (immediate feedback, running score, reset).

## Grounding rules

- Quote thresholds, defaults, and formulas exactly as the corpus states them, and label them defaults if the corpus does.
- Attribute nothing to the domain that the corpus does not assert. Background needed to make a corpus term intelligible (what an amino acid is, what a regex class matches) is fine; new domain claims, numbers, or mechanisms are not.
- When corpus files disagree, teach the newer or more specific source and say the older render differs.
- Name the source files in a colophon so the reader can go verify.

## Additional resources

- **`references/curriculum.md`** — lesson anatomy, sequencing patterns, content-type priorities, worked arc from a real spec corpus.
- **`references/quiz.md`** — the seven question archetypes with worked examples, distractor construction, open-question design, scoring conventions.
- **`assets/quiz-scaffold.html`** — copy-and-fill scaffold: question markup, verdict blocks, score bar, reveal/reset script.
