# Skill shape: router (dispatch over branches)

A **thin dispatch table**: it names the branches, matches the request to one, loads that branch's guide, and gets out of the way. This skill (`skill-build`) is one.

## Two layers

- **Router** — frontmatter, at most one framing paragraph (what every path shares), the branch table. Nothing a single branch would own.
- **Branch** — one `references/<branch>.md` per row. Everything for that path, nothing about the others.

Principles common to all branches live in one `references/<shared>.md` (`foundations.md` here), pointed to once from the framing paragraph.

## Make dispatch land

- **Branch table** — one row per branch: the name, a *Use when…* cell, the guide path. The name is a leading word: the same token in the description, the table, and the filename.
- **Mutually exclusive, collectively exhaustive** — every real request matches exactly one row. Each cell states what makes this branch *not* its neighbour.
- **One branch, one load** — the agent reads the router, picks one row, loads one guide.
- **Every branch is wired** — a row whose guide file is missing is a dead branch. Done when every row resolves to a file.
