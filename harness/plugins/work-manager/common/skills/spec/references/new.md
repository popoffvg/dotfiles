# spec — new

Interview the user about `<notes-dir>/spec.md` until you reach shared understanding and the
spec's **Open Questions** list is empty. The decision tree IS the spec — walk it branch by
branch, resolving dependencies between decisions one at a time.

If a question can be answered by reading the codebase, read it instead of asking.

For each question, provide your recommended answer.

## What to grill (in order)

Walk these spec.md sections depth-first. Resolve one branch fully before switching.

1. **Open Questions** — every `- [ ]` is an open branch. These come first.
2. **Design Decisions** — for each: is the Motivation sufficient? Are there missing alternatives? Does it contradict another decision?
3. **Spec vs code** — validate stated behavior against the actual implementation. Read the files the spec touches and surface every contradiction: *"The spec says partial cancellation is allowed, but `cancelOrder` deletes the whole aggregate — which is right?"* A spec that disagrees with the code it builds on is the highest-value bug to catch here.
4. **Goal vs TODO List** — does every TODO outcome trace to the Goal? Any Goal aspect with no TODO? Any TODO not serving the Goal (scope creep → belongs in *What we're NOT doing*)?
5. **Terms** — any term used in Goal/Decisions but undefined, or defined but ambiguous (TTL? bounds? error semantics?)? When the user reaches for vague language, propose a precise **canonical term** and pin it in the Terms table. Flag any wording that contradicts an existing Terms-table definition.
6. **What we're NOT doing** — is each exclusion deliberate, or an unspoken assumption that should be a decision?

## Interview techniques

- **Validate against code, don't just ask.** Before accepting a stated behavior, check the implementation. Lead with the contradiction, not the question.
- **Challenge terminology.** Vague language → propose the canonical term and write it down. Keep Terms a pure glossary: entity/event/command names and meanings, no implementation detail.
- **Stress-test with concrete scenarios.** Force precision on boundaries with real edge cases: *"Two refreshes race on the same expired token — what happens?"* Boundaries and relationships surface faster from a scenario than from an abstract question.
- **Grill one failure path, not just the happy path.** For each decision that has an error arm, ask the two leak questions: does the response differ by cause when it shouldn't (e.g. unknown-account vs wrong-password → user enumeration)? does one branch take measurably longer than another (timing side channel)? The happy path shows what the spec does; the failure path shows what it gets wrong. If sameness is required, pin it as a Design Decision so the implementer doesn't "helpfully" split the arms.

## Operating mode

- Ask **one focused question at a time**. Wait for the answer before advancing.
- Depth-first: chase one decision's dependencies before switching branches.
- Recommend an answer for every question, with a one-line reason.
- **Update `spec.md` inline as each point resolves — never batch edits to the end.** A resolved term lands in Terms immediately; a settled choice lands in Design Decisions or *What we're NOT doing*; a closed question is deleted from Open Questions. The spec is always current.
- **Record a Design Decision sparingly** — only when the choice is hard to reverse, surprising without context, *and* came from a genuine trade-off. Routine resolutions just update Terms or scope; don't inflate Design Decisions with them.
- Keep a **live checklist** of resolved vs unresolved decisions (echo it as you go).
- Every 5–8 questions, summarize: assumptions, decisions made, risks, remaining open.
- Stop only when Open Questions is empty **and** no unresolved decisions remain, or the user says stop.

## Exit contract (differs from grill-me — this mutates the spec)

Because edits land inline during the loop, exit is a reconciliation pass, not a write-everything-now step. When the loop ends, confirm `<notes-dir>/spec.md` reflects every resolution:
1. Each resolved decision is in **Design Decisions** (Decision oneliner / Motivation / Alternatives) or, if routine, captured in Terms / scope.
2. Newly-discovered out-of-scope items are in **What we're NOT doing**.
3. **Open Questions is empty** — any surviving `- [ ]` line means the spec is NOT READY.
4. Append a one-line entry to `<notes-dir>/worklog.md`: what was grilled, decisions added, questions closed.

Then report:
1. Final shared-understanding summary
2. Decision log (what / why) — mirrors what you wrote to spec.md
3. Remaining unknowns (should be none for READY)
4. Recommended next action (`verify`, or draft TODO bodies via `todo`)

> A spec with a non-empty Open Questions list cannot pass `verify`. This skill is how it gets to empty.
