# code — new

Default subcommand. Spec pipeline: write spec → grill → produce notes → compile plan → **stop**.

**Does NOT write TODO bodies.** TODO body files (`todos/TODO-N.md`) are authored only by the
`todo` subcommand, and only after a human has manually reviewed the spec. `new` ends at a
reviewable spec + thought graph; the human is the gate between spec and TODOs.

## Step 0: Starting state

> The notes jj repo (spec history; `jj log`) is initialized automatically on session start and
> committed on stop — see @references/jj-notes.md. No manual init or worklog here.

If `<notes-dir>/spec.md` does not exist, write a minimal spec.md first:

- **Header** — the status header (see `write.md` § spec.md template). Set `Status: init`, and
  fill the `This spec drives:` line with one sentence from the user's request. Keep the phase-rules block verbatim.
- **Description** — one sentence from the user's request.
- **Goal** — 2-3 sentences, plain language, no IDs.
- Create `<notes-dir>/GLOSSARY.md` from `references/glossary-template.md`, empty (no rows yet).
- **Implementation Guidelines** — omit or write "Follow language defaults."
- **What we're NOT doing** — leave empty (fill during grill if needed).
- **Design Decisions** — leave empty.
- **Open Questions** — seed with 1-3 questions from the user's request.
- **TODO List** — empty; fill after grill completes.

If spec.md exists (iteration), skip directly to Step 0.5.

Full spec.md structure reference: [`write.md`](write.md).

---

## Step 0.5: Ingest explore artifacts

Run this step every time — whether spec.md was just created or already existed.

Check `<notes-dir>/research/` for explore-phase artifacts:

```bash
ls <notes-dir>/research/ 2>/dev/null
```

**If the directory is empty or missing** — skip to Step 1.

**If research artifacts exist:**

1. **Read the index first.** If `<notes-dir>/research/INDEX.md` exists, read it to get the full list of entry points researched. Then read each referenced `<ep-slug>.md`. If no INDEX.md, read every `.md` file directly.

2. **Extract concrete facts.** For each research doc, collect:
   - Observed code behaviors (existing interfaces, types, constraints, TTLs, error shapes)
   - User-stated assertions recorded during explore
   - Gaps flagged as open questions or unknowns

3. **Write fact notes.** For each concrete finding, write a `NNN-fact-*.md` to `<notes-dir>/thoughts/` using the fact template (`references/note-template-fact.md`). Set `source: explore` in frontmatter. Use the shared note counter (start at 001 if thoughts/ is empty, else increment from the highest existing `NNN`).
   - One fact note per distinct finding. Do not merge unrelated facts.
   - **Write fact notes before starting the grill loop** — they must exist so decision notes can link to them.

4. **Seed Open Questions.** For each gap or unresolved question found in research (sections like "Open Questions", "Gaps", or "Unknown"), add a `- [ ]` entry to spec.md's **Open Questions** if not already present. Prefix with `[from explore]` so origin is clear.

5. **Report the harvest.** Before starting the grill loop, print one line:
   > Ingested explore artifacts: N fact notes written, M open questions added from research.

After this step, the grill loop starts with a populated fact graph — decisions made during grilling MUST reference these fact notes via `[[wikilinks]]` wherever the facts constrain the choice.

---

## Step 1: Grill loop

Interview the user about `<notes-dir>/spec.md` until shared understanding is reached and the
spec's **Open Questions** list is empty. Every resolved question produces an Obsidian note
(`decision` or `fact`) in `<notes-dir>/thoughts/`, building a traceable thought graph.
The decision tree IS the spec — walk it branch by branch, write one note per resolution.

If a question can be answered by reading the codebase, read it instead of asking.

For each question, provide your recommended answer.

## Notes directory

```
_notes/
  spec.md
  thoughts/
    NNN-decision-slug.md   ← one per decision
    NNN-fact-slug.md       ← one per fact
```

- Notes are standalone Obsidian files. Format: `spec/references/note-format.md`.
- `NNN` is a 3-digit sequential counter starting at `001`. Shared across types.
- Facts are evidence (code observations, user assertions, research findings).
- Decisions are choices with alternatives, reasoning, and links to constraining facts.

## What to grill (in order)

Walk these spec.md sections depth-first. Resolve one branch fully before switching.

1. **Open Questions** — every `- [ ]` is an open branch. These come first.
2. **Design Decisions** — for each: is the Motivation sufficient? Are there missing alternatives? Does it contradict another decision?
3. **Spec vs code** — validate stated behavior against the actual implementation. Read the files the spec touches and surface every contradiction: *"The spec says partial cancellation is allowed, but `cancelOrder` deletes the whole aggregate — which is right?"* A spec that disagrees with the code it builds on is the highest-value bug to catch here.
4. **Goal vs TODO List** — does every TODO outcome trace to the Goal? Any Goal aspect with no TODO? Any TODO not serving the Goal (scope creep → belongs in *What we're NOT doing*)?
5. **Terms** — any term used in Goal/Decisions but undefined, or defined but ambiguous (TTL? bounds? error semantics?)? When the user reaches for vague language, propose a precise **canonical term** and write it into `GLOSSARY.md` immediately. Flag any wording that contradicts an existing GLOSSARY.md definition.
6. **What we're NOT doing** — is each exclusion deliberate, or an unspoken assumption that should be a decision?

## Operating mode

### Ask → Answer → Write note → Update spec

For each resolved question, execute this cycle:

1. **Ask one question** — with a recommended answer and one-line reason.
2. **User answers** — accept, choose alternative, or provide new information.
3. **Write one note** to `<notes-dir>/thoughts/`:
   - If the resolution is a **choice** → `decision` note. Record the question, recommendation, resolution, why (alternatives + reasoning), and links to constraining facts/prior decisions.
   - If the resolution establishes a **fact** (code observation, user assertion, constraint) → `fact` note. Record what, where, evidence (verbatim), and what decisions it constrains.
   - If the user provides new information that is neither → ask: "Is this a decision you're making, or a fact you're establishing?" Then write accordingly.
   - Write immediately after the user answers — do not batch. The note is the primary artifact; spec.md updates follow.
4. **Update `spec.md` and `GLOSSARY.md` inline** — never batch edits to the end. A resolved term lands in `GLOSSARY.md` immediately; a settled choice lands in spec.md's Design Decisions; a closed question is deleted from Open Questions. Both files are always current.
5. **Increment the note counter** `N` for the next note.

### Rules

- Depth-first: chase one decision's dependencies before switching branches.
- Recommend an answer for every question, with a one-line reason.
- **Write a fact note BEFORE the decision it constrains.** When the codebase reveals a constraint (TTL, interface shape, existing behavior), write it as a fact note first, then reference it from the decision note.
- **Reuse explore-derived facts.** If a question is answered by a fact note already written in Step 0.5, link to it instead of re-deriving. Write a new fact note only if the evidence is genuinely new.
- **Record a Design Decision sparingly** — only when the choice is hard to reverse, surprising without context, *and* came from a genuine trade-off. Routine resolutions just update GLOSSARY.md or scope; don't inflate Design Decisions with them.
- Keep a **live checklist** of resolved vs unresolved decisions (echo it as you go).
- Every 5–8 questions, summarize: assumptions, decisions made, risks, remaining open.
- Stop only when Open Questions is empty **and** no unresolved decisions remain, or the user says stop.

### Interview techniques

- **Validate against code, don't just ask.** Before accepting a stated behavior, check the implementation. Lead with the contradiction, not the question. If the code reveals a fact, write a fact note before asking the user about the resolution.
- **Challenge terminology.** Vague language → propose the canonical term and write it into `GLOSSARY.md`. Keep GLOSSARY.md a pure glossary: entity/event/command names and meanings, no implementation detail.
- **Stress-test with concrete scenarios.** Force precision on boundaries with real edge cases: *"Two refreshes race on the same expired token — what happens?"* Boundaries and relationships surface faster from a scenario than from an abstract question.
- **Grill one failure path, not just the happy path.** For each decision that has an error arm, ask the two leak questions: does the response differ by cause when it shouldn't (e.g. unknown-account vs wrong-password → user enumeration)? does one branch take measurably longer than another (timing side channel)? The happy path shows what the spec does; the failure path shows what it gets wrong. If sameness is required, pin it as a Design Decision so the implementer doesn't "helpfully" split the arms.

## Exit contract

### 1. Back-link all notes

Walk every note in `thoughts/`:

- For each `Depends on` entry in note B that points to note A, add a corresponding `Affects` entry in note A pointing back to note B.
- Populate the `links` frontmatter YAML list on every note with ALL `[[wikilinks]]` that appear in its body. This ensures Obsidian's graph view shows every connection.
- Verify every `[[wikilink]]` target exists as a file in `thoughts/`. If a link target was renamed or missing, fix it.

### 2. Confirm spec.md reflects every resolution

1. Each resolved decision is in **Design Decisions** (Decision oneliner / Motivation / Alternatives) or, if routine, captured in GLOSSARY.md / scope.
2. Newly-discovered out-of-scope items are in **What we're NOT doing**.
3. **Open Questions is empty** — any surviving `- [ ]` line means the spec is NOT READY.
4. **Advance status: `init` → `review`.** Set the header `Status:` field to `review` — the spec is now authored and ready for human review.
5. Run `jj commit -m "<what was grilled, decisions added, questions closed, note count>"` in `<notes-dir>`.

### 3. Compile the plan

Write a **Plan** section at the bottom of `spec.md`:

```markdown
## Plan

<3-5 sentences summarizing the target picture. One sentence per major branch of the decision tree.>

### Decision trail

| # | Note | Decision | Constrained by | Affects |
|---|------|----------|----------------|---------|
| 001 | [[001-fact-token-ttl]] | *(fact)* | — | 003 |
| 003 | [[003-decision-single-flight]] | Reject concurrent refreshes with 409 | [[001-fact-token-ttl]] | — |
```

The plan is a reader's entry point into the notes. **Traceable thoughts** = every decision links backward to its facts and forward to its consequences. A reviewer starts at the Plan, follows links to notes, follows `Depends on` backward and `Affects` forward, and reconstructs the full decision tree without reopening the conversation.

### 4. Report

Print to the user:

1. Final shared-understanding summary (2-3 sentences)
2. Note count: N decisions, M facts
3. Decision trail table (copy from spec.md Plan section)
4. Remaining unknowns (should be none for READY)
5. Recommended next action: **review the spec manually**, then run `/code todo` to author TODO bodies.

> A spec with a non-empty Open Questions list is not ready for review. This skill is how it gets to empty.

---

## Stop here — human review gate

`new` ends after the plan is compiled. **Do not write `todos/TODO-N.md` files.**

The spec + thought graph are now a reviewable artifact. The human reviews the spec (Goal,
Design Decisions, GLOSSARY.md, TODO List outcomes, decision trail) and, when satisfied, runs
`/code todo` to author the TODO bodies. Authoring TODOs before that review is the mistake this
gate exists to prevent — a wrong spec turns into wrong TODOs turns into wrong code.

If the review surfaces gaps, run `/code new` again (iteration) to reopen and re-grill.
