# template — teach learning record

Learning records live in `<notes-dir>/teach/learning-records/` as `NNNN-<slug>.md` — `0001-…`,
`0002-…`. Create the directory on the first record. Used by `sub-teach.md`.

They are the teaching counterpart of a `thoughts/` decision note: they capture the non-obvious
lesson, the key insight, or the disclosed prior knowledge that steers the next session. They are the
input to the level calculation — the floor of what is already known.

## Template

```md
# {Short title of what was learned or established}

{1-3 sentences: what was learned (or what prior knowledge was established), and why it changes what
to teach next.}
```

That is the whole format. One paragraph is a complete record. The value is recording *that* this is
now known and *why* it moves the level — not in filling sections.

## Optional sections

Include only when they add real value. Most records need none.

- **`status` frontmatter** (`active` | `superseded by LR-NNNN`) — for when an earlier understanding
  turns out wrong and is replaced.
- **Evidence** — how the human showed the understanding: a quiz question answered, a call traced, a
  test they predicted correctly, prior experience cited. Worth having when the claim may be revisited.
- **Implications** — what this unlocks or rules out for later lessons, when that is not obvious.

## Numbering

Scan `learning-records/` for the highest number and increment by one.

## When to write one

Write a record when any of these holds:

1. **The human demonstrated genuine understanding of something non-trivial** — evidence they can use
   the concept correctly, not that it was covered. This sets a new floor.
2. **The human disclosed prior knowledge** — "I already know X." Record it, and the depth claimed, so
   later sessions do not re-teach it.
3. **A misconception was corrected** — they believed something wrong about the code and now see why.
   The highest-value kind: it predicts where they will stumble on related code.
4. **The mission shifted from what was learned** — link `[[MISSION.md]]` and update it.

### What does not qualify

- Material merely covered. Coverage is not learning; wait for evidence.
- A term already defined in `<notes-dir>/GLOSSARY.md`. Do not duplicate the definition here.
- A session activity log. Records are decision-grade insights, not a journal.

## Superseding

A later record that contradicts an earlier one marks the old one `status: superseded by LR-NNNN`
rather than deleting it. How the understanding evolved is itself signal for what to teach next.
