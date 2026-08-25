# Skill shape: router (dispatch over branches)

Author a skill whose body is a **thin dispatch table** — it names a set of branches, matches the request to one, loads that branch's guide, and gets out of the way. The router holds no branch logic; each branch owns its own reference. This skill (`skill-build`) is a router. Shared vocabulary: `foundations.md`.

## The two layers

Keep them apart, as `loop` keeps flow and control apart:

- **Router** — the dispatch. Frontmatter, one framing paragraph, the branch table. Nothing a single branch would own.
- **Branch** — one `references/<branch>.md` per row. Holds everything for that path and nothing about the others.

A branch detail leaking into the router, or a router concern restated in every branch, is the defect this shape exists to prevent.

## Structure

- **Branch table** — one row per branch: the branch name, a *Use when…* cell that discriminates it from its siblings, and the guide path. The name is a leading word: the same token in the description, the table, and the guide filename.
- **Framing paragraph** — at most one, above the table: what every path shares. Skip it when nothing is shared.
- **Cross-cutting reference** — principles common to all branches live in one `references/<shared>.md` (as `foundations.md` does here), pointed to once from the framing paragraph, never copied per branch.

## Make dispatch land

- **Mutually exclusive, collectively exhaustive** — the *Use when…* cells partition the space: every real request matches exactly one row. Overlap sends the agent to two branches; a gap sends it to none.
- **Discriminate, don't describe** — each cell states what makes this branch *not* its neighbour, so the match is a checkable pick.
- **One branch, one load** — the agent reads the router, picks one row, loads one guide. Progressive disclosure is the whole point: the router stays cheap, the depth lives behind the pointers.

## Every branch is wired

The router promises a guide per row, so a row whose `references/<branch>.md` is missing is a dead branch. Create the reference in the same change that adds the row, and confirm every row resolves to a file before finishing.

## Output

`SKILL.md` with frontmatter, framing paragraph, and branch table, each row resolving to a `references/<branch>.md`; shared principles in one referenced file.
