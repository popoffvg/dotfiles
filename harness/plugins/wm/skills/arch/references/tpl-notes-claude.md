# Notes corpus

> This file is the finished `<notes-dir>/CLAUDE.md`. Copy it there verbatim, replace `<notes-dir>`
> with the real path, and delete this line. Written once by `/code new` Step 0, next to `spec.md`;
> no later subcommand rewrites it.

This folder is the spec corpus for one piece of work. It is its own jj repo, git-ignored in the
parent project. `jj -R . log` is the history.

## Map

| Path | Holds | Written by |
|------|-------|------------|
| `spec.md` | Target picture + the ledger (`Layer \| Outcome \| Commit`) + the Plan with its wave table | `/code new`, `/code revise` |
| `GLOSSARY.md` | Project ubiquitous language — every term the spec uses | every phase |
| `RULES.md` | What to raise with the human at each step, and what to decide alone | `/code new` Step 0.6 |
| `PATTERNS.md` | Implementation patterns + reference files the increments follow — for the implementer, not the human | `/code new` Step 0, then any subcommand that finds a pattern |
| `thoughts/` | `NNN-{question,decision,fact,impl-decision}-slug.md` — the thought graph | every phase |
| `thoughts/archived/` | Answered questions + superseded thoughts — kept for the trail, out of the live graph | a hook, on any note that stops being live |
| `todos/` | `TODO-N.md` — one self-contained body per ledger row | `/code todo` |
| `research/` | Explore-phase artifacts, ingested into `thoughts/` as facts | `/explore` |

## Read order

1. `spec.md` — Description, Goal, What we're NOT doing, the ledger, the Plan.
2. `GLOSSARY.md` — the terms the spec uses. Same word, same meaning, everywhere.
3. `RULES.md` — the interaction contract for the current step.
4. `thoughts/` — why each choice was made. Enter through a TODO's `## Constraints` links.
5. `todos/TODO-N.md` — the body to implement. Self-contained: read it alone, implement it alone.
6. `PATTERNS.md` — before writing code: the patterns that body's increments follow, and the files to pre-read.

Ignore `thoughts/archived/` unless you are auditing history. Those notes were answered or superseded.

## Write rules

- **A question is answered by a new note, never edited into its answer.** The answer is a
  `decision` or `fact` note at the next `NNN`, restating the question verbatim; the question note
  gets `status: approved` + `superseded_by:` and a hook archives it. Never open a second note
  asking the same thing.
- **Supersede, never delete.** Mark the old note `Superseded by [[NNN-type-slug]]` with
  `status: declined` + `superseded_by:`; a hook moves it to `thoughts/archived/` for you. The
  replacement takes the next counter.
- **Decisions are not spec sections.** `spec.md` has no `Design Decisions` and no
  `Open Questions` — both live in `thoughts/`.
- **Patterns are not spec sections.** `spec.md` mentions `@PATTERNS.md`; the patterns and the
  reference files live there. A pattern with no example in the repo is a decision — `thoughts/`.
- **The ledger holds outcomes, not bodies.** No file paths, no checkboxes in `spec.md`.
- **Every new term goes in `GLOSSARY.md`** in the same edit that introduces it.
- **Spec scaffolding stays out of the code.** No TODO number, step number, wave, layer number, or
  file name from this corpus in source, identifiers, comments, or commit bodies. Name the work by
  its domain term: step 3 "calculate liabilities" becomes `calculateLiabilities` — never `step3`
  or "next step 4". If the step has no domain name, add one to `GLOSSARY.md` first.
- **Ask what `RULES.md` says to ask.** Do not decide alone what that file marks as human-owned.

## Status

`spec.md` frontmatter `status`: `init → review → impl`. Each `todos/TODO-N.md` frontmatter
`status`: `todo → impl → verify → done`, with `blocked` as the failure branch.
A `status: open` question note in `thoughts/` blocks the gate — list them with
`~/.claude/scripts/wm-open-questions.sh thoughts`.
