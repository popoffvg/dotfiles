# Notes corpus — how to work here

Template for `<notes-dir>/CLAUDE.md`. Written once by `/code new` Step 0, next to `spec.md`.
Copy the block below verbatim; replace `<notes-dir>` with the real path. Do not paste this
header into the copy.

---

```markdown
# Notes corpus

This folder is the spec corpus for one piece of work. It is its own jj repo, git-ignored in the
parent project. `jj -R . log` is the history.

## Map

| Path | Holds | Written by |
|------|-------|------------|
| `spec.md` | Target picture + the ledger (`Layer \| Outcome \| Commit`) + the Plan with its wave table | `/code new`, `/code revise` |
| `GLOSSARY.md` | Project ubiquitous language — every term the spec uses | every phase |
| `RULES.md` | What to raise with the human at each step, and what to decide alone | `/code new` Step 0.6 |
| `thoughts/` | `NNN-{question,decision,fact,impl-decision}-slug.md` — the thought graph | every phase |
| `thoughts/archived/` | Superseded thoughts — kept for the trail, out of the live graph | `/code revise`, `/code fix` |
| `todos/` | `TODO-N.md` — one self-contained body per ledger row | `/code todo` |
| `research/` | Explore-phase artifacts, ingested into `thoughts/` as facts | `/explore` |

## Read order

1. `spec.md` — Description, Goal, What we're NOT doing, the ledger, the Plan.
2. `GLOSSARY.md` — the terms the spec uses. Same word, same meaning, everywhere.
3. `RULES.md` — the interaction contract for the current step.
4. `thoughts/` — why each choice was made. Enter through a TODO's `## Constraints` links.
5. `todos/TODO-N.md` — the body to implement. Self-contained: read it alone, implement it alone.

Ignore `thoughts/archived/` unless you are auditing history. Those notes are superseded.

## Write rules

- **One thought per topic.** A question note flips in place into a `decision` or `fact` note —
  same `NNN`, renamed file. Never open a second note for the same topic.
- **Supersede, never delete.** Mark the old note `Superseded by [[NNN-type-slug]]`, then move it
  to `thoughts/archived/`. The replacement takes the next counter.
- **Decisions are not spec sections.** `spec.md` has no `Design Decisions` and no
  `Open Questions` — both live in `thoughts/`.
- **The ledger holds outcomes, not bodies.** No file paths, no checkboxes in `spec.md`.
- **Every new term goes in `GLOSSARY.md`** in the same edit that introduces it.
- **Ask what `RULES.md` says to ask.** Do not decide alone what that file marks as human-owned.

## Status

`spec.md` frontmatter `status`: `init → review → impl`. Each `todos/TODO-N.md` frontmatter
`status`: `todo → impl → verify → done`, with `blocked` as the failure branch.
A `status: open` question note in `thoughts/` blocks the gate — list them with
`~/.claude/scripts/wm-open-questions.sh thoughts`.
```
