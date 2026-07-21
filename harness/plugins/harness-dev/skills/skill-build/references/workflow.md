# Skill shape: workflow (ordered steps)

Author a skill whose body is an **ordered sequence of steps** — a procedure run once, top to bottom.

Shared principles (pruning, leading words, failure modes): `references/foundations.md`.

## Structure

- Each step is one imperative action, in order. Write verb-first, no second person.
- Number steps only when order is load-bearing; otherwise a bulleted sequence.

## Completion criterion — the core of a step

Every step ends on a **completion criterion**: the condition that tells the agent the step is done. Make it:

- **Checkable** — the agent tells done from not-done. Not "review the models" but "every modified model appears in the change list".
- **Exhaustive** where it matters — "every X accounted for", not "produce a list of X". A vague criterion invites **premature completion** (see foundations → Failure modes for the split defence).

## Output

`SKILL.md` with frontmatter + the ordered steps, each carrying its completion criterion. Detailed lookups disclosed to `references/`.
