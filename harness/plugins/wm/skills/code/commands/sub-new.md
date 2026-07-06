# code — new (the grill loop)

Default subcommand. Spec pipeline: write spec → **grill** → produce thoughts → compile plan →
**stop at the gate**. Owns the grill loop and the exit contract. Contract, layout, Status, and
the gate itself: `ref-write.md`. Vocabulary: `../GLOSSARY.md`.

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

## Step 0: Starting state

> The notes jj repo is inited on session start and committed on stop — `ref-jj-notes.md`. No manual init.

No `<notes-dir>/spec.md` → write a minimal one (full template: `ref-write.md` § spec.md template):

- **Header** — `Status: init`, `This spec drives:` from the user's request, phase-rules block verbatim.
- **Description** — one sentence from the request. **Goal** — 2–3 plain sentences.
- **Open Questions** — seed 1–3 from the request. **TODO List** — empty until the grill closes.
- Create `<notes-dir>/GLOSSARY.md` from `references/tpl-glossary.md`, empty.
- Guidelines / What we're NOT doing / Design Decisions — empty or "follow language defaults".

spec.md exists → this is iteration; skip to Step 0.5.

## Step 0.5: Ingest explore artifacts

Run every time. Check `<notes-dir>/research/`:

- Empty or missing → skip to Step 1.
- Present → read `INDEX.md` first (else every `.md`). For each concrete finding — observed code behavior, user assertion, flagged gap — write one `NNN-fact-*.md` thought (`source: explore`, template `tpl-note-fact.md`, shared counter from 001). One fact per finding; **before the grill starts**, so decisions can link them. Seed each research gap into Open Questions, prefixed `[from explore]`. Print: `Ingested explore artifacts: N fact notes, M open questions.`

## Step 1: Grill

Interview the user about `spec.md` until Open Questions is empty. Every resolution writes one
thought (`ref-note-format.md`); the decision tree **is** the spec — walk it branch by branch. A
question the codebase can answer, read instead of ask. Recommend an answer for every question.

### What to grill, in order — depth-first, one branch fully before switching

1. **Open Questions** — every `- [ ]` is an open branch. First.
2. **Design Decisions** — each: is the Motivation sufficient? missing alternatives? contradicts another?
3. **Spec vs code** — validate stated behavior against the implementation. Lead with the contradiction: *"spec says partial cancellation is allowed, but `cancelOrder` deletes the whole aggregate — which is right?"* A spec that disagrees with the code it builds on is the highest-value catch here.
4. **Goal vs ledger** — every outcome traces to the Goal? any Goal aspect with no TODO? any TODO not serving the Goal (scope creep → *What we're NOT doing*)?
5. **Terms** — any term used but undefined, or defined but ambiguous (TTL? bounds? error semantics?)? Propose a precise canonical term and write it to `GLOSSARY.md` immediately.
6. **What we're NOT doing** — each exclusion deliberate, or an unspoken assumption that should be a decision?

### Operating mode — Ask → Answer → Write thought → Update spec

For each resolved question:

1. **Ask one question** — with a recommended answer and one-line reason.
2. **User answers** — accept, pick an alternative, or add information.
3. **Write one thought** immediately (never batch — the thought is the primary artifact). Choice → `decision` note; established truth → `fact` note; neither → ask "a decision you're making, or a fact you're establishing?" then write accordingly. Note types, sections, templates: `ref-note-format.md`.
4. **Update `spec.md` + `GLOSSARY.md` inline** — a resolved term lands in GLOSSARY.md, a settled choice in Design Decisions, a closed question is deleted from Open Questions. Both files always current.
5. **Increment the note counter.**

Rules: a **fact note goes in before the decision it constrains**. Reuse explore-derived facts — link, don't re-derive. Record a Design Decision sparingly (hard-to-reverse, surprising, genuine trade-off); routine resolutions just touch GLOSSARY.md or scope. Echo a live resolved/unresolved checklist every 5–8 questions with a summary. Stop when Open Questions is empty and no unresolved decision remains, or the user says stop.

### Interview techniques

- **Validate against code, don't just ask.** Check the implementation before accepting stated behavior; if code reveals a constraint, write a fact note first.
- **Challenge terminology.** Vague language → propose the canonical term, write it to GLOSSARY.md. Keep GLOSSARY.md pure: names and meanings, no implementation detail.
- **Stress-test with scenarios.** Force precision on boundaries: *"two refreshes race on the same expired token — what happens?"*
- **Grill one failure path.** For each error arm, ask the two leak questions: does the response differ by cause when it shouldn't (unknown-account vs wrong-password → enumeration)? does one branch take measurably longer (timing side channel)? If sameness is required, pin it as a Design Decision so the implementer doesn't split the arms.

### Condensed variant — ≤ 3 TODOs

Known scope, 0–2 open questions, terms mostly known → run a narrower grill: confirm the Goal
(one question, write a fact), resolve Open Questions, scan outcomes for undefined terms, surface
**one** spec-vs-code contradiction. Skip proactive What-we're-NOT-doing grilling, the Goal-vs-ledger
trace, and the failure-path leak questions unless the user raises them. Same exit contract, same
gate — a small wrong spec still becomes a small wrong TODO. Full design exploration (3+ open
questions, emerging domain model, >3 TODOs) → run the full grill above.

## Exit contract

### 1. Back-link every thought
Back-fill `Affects` and populate `links` per `ref-note-format.md` § Back-linking.

### 2. Confirm spec.md reflects every resolution
Each decision is in Design Decisions (or, if routine, in GLOSSARY.md / scope); new out-of-scope items in What we're NOT doing; **Open Questions empty** (any surviving `- [ ]` = NOT READY). Advance `Status: init → review`. Self-check against `ref-write.md` § Spec-Readiness Checklist.

### 3. Compile the plan
Write a `## Plan` at the bottom of spec.md — 3–5 sentences (one per major branch) plus the **trace** table:

```markdown
## Plan

<target-picture summary, one sentence per branch>

### Decision trail
| # | Note | Decision | Constrained by | Affects |
|---|------|----------|----------------|---------|
| 001 | [[001-fact-token-ttl]] | *(fact)* | — | 003 |
| 003 | [[003-decision-single-flight]] | Reject concurrent refreshes with 409 | [[001-fact-token-ttl]] | — |
```

The Plan is the reader's entry point: start there, follow `Depends on` backward and `Affects` forward, reconstruct the whole tree without reopening the conversation.

### 4. Commit + report
`jj commit -m "<what was grilled, decisions added, questions closed, note count>"` in `<notes-dir>`. Then print: shared-understanding summary (2–3 sentences), note count (N decisions, M facts), the decision-trail table, remaining unknowns (none for READY), and the next action — **review the spec, then `/code todo`**.

## Stop at the gate

`new` ends here. It does not write `todos/TODO-N.md`. The spec + thought graph are now
reviewable; the human reviews and runs `/code todo` when satisfied (the gate — `ref-write.md`). Review
surfaces gaps → run `/code new` again to re-grill.
