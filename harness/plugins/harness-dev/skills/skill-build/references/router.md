# Skill shape: router (dispatch over branches)

Author a skill whose body is a **thin dispatch table** — it names a set of branches, matches the request to one, loads that branch's guide, and gets out of the way. The router holds no branch logic; each branch owns its own reference. This skill (`skill-build`) is a router.

Shared principles (pruning, leading words, failure modes): `references/foundations.md`.

## The two layers

Keep them apart, as `loop` keeps flow and control apart:

- **Router** — the dispatch. Frontmatter, one framing paragraph, the branch table. Nothing a single branch would own.
- **Branch** — one `references/<branch>.md` per row. Holds everything for that path and nothing about the others.

A branch detail that leaks into the router, or a router concern restated in every branch, is the defect this shape exists to prevent.

## Structure

- **Branch table** — one row per branch: the branch name, a *Use when…* cell that discriminates it from its siblings, and the guide path. The name is a leading word — the same token in the description, the table, and the guide filename.
- **Framing paragraph** — at most one, above the table: what a branch settles that every path shares (`skill-build` settles the frontmatter fields here). Skip it when nothing is shared.
- **Cross-cutting reference** — pull principles common to all branches into one `references/<shared>.md` (like `foundations.md`), pointed to once from the framing paragraph — never copied into each branch.

## Make dispatch land

- **Mutually exclusive, collectively exhaustive** — the *Use when…* cells partition the space: every real request matches exactly one row. Overlap sends the agent to two branches; a gap sends it to none.
- **Discriminate, don't describe** — each cell states what makes this branch *not* its neighbour, so the match is a checkable pick.
- **One branch, one load** — the agent reads the router, picks one row, loads one guide, ignores the rest. Progressive disclosure is the whole point: the router stays cheap, depth lives behind the pointers.

## Every branch is wired

The router promises a guide per row; a row whose `references/<branch>.md` is missing is a dead branch. When adding a row, create its reference in the same change. Verify every row resolves to a file before finishing.

## Output

`SKILL.md` with frontmatter + framing paragraph + branch table, each row resolving to a `references/<branch>.md`; shared principles in one referenced file, never duplicated per branch.
