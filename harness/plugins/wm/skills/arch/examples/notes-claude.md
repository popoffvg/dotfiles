# Notes corpus

> Copy to `<notes-dir>/CLAUDE.md` verbatim, replacing `<notes-dir>` with the real path. Written once
> by `/code new` Step 0, next to `spec.md`; no later subcommand rewrites it. Delete this block on
> copy; it is the only `>` block here, because a file copied verbatim needs no per-section rules —
> its own prose is the contract the notes corpus obeys.
> The prose follows `harness-dev:text-style`.

This folder is the spec corpus for one piece of work. It is its own jj repo, git-ignored in the
parent project. `jj -R . log` is the history.

## Map

| Path | Holds | Written by |
|------|-------|------------|
| `spec.md` | Target picture + the ledger (line roster: `arch:ref-write.md` § Spec-Readiness Checklist) + the Plan with its wave table | `/code new`, `/code revise` |
| `GLOSSARY.md` | Project ubiquitous language — every term the spec uses | every phase |
| `RULES.md` | What to raise with the human at each step, and what to decide alone | `/code new` Step 0.6 |
| `PATTERNS.md` | Implementation patterns + reference files the increments follow — for the implementer, not the human | `/code new` Step 0, then any subcommand that finds a pattern |
| `CONCEPTS.md` | App architecture, data flow, and the flow this work changes — every diagram, drawn with `show-me` | `/code new` Step 0, when there is structure to draw |
| `adr/` | `NNNN-slug.md` — one ADR per decision; a file here is live, and `status: approved` is set by the operator alone | every phase, with the `adr` skill |
| `QUESTIONS.md` | One `## <slug>` section per open question; the spec is not ready while it has one | every phase; an answer deletes its section |
| `adr/archived/` | Deprecated and superseded ADRs — kept for the trail | a hook, on any ADR that stops being live |
| `todos/` | `CLAUDE.md` (the pair convention) + `TODO-N.md` + `TODO-N.agent.md` + `TODO-N.test.md` — one self-contained row per ledger row: the human half (Outcome, Delivers, New terms, Components, Surface, Flow changes, Increments, Commit), the test file (Autotest), and the agent half (Files, Pre-reads, Manual test) | `/code new` (the folder + `CLAUDE.md`), `/code todo` (the pairs) |
| `research/` | Explore-phase artifacts — every fact with its source; ADRs cite them | `/dive docs` |

## Read order

1. `CONCEPTS.md` — the diagrams, if the file exists. Then `spec.md` — Description, Goal, What we're NOT doing, the ledger, the Plan.
2. `GLOSSARY.md` — the terms the spec uses. Same word, same meaning, everywhere.
3. `RULES.md` — the interaction contract for the current step.
4. `~/.claude/scripts/wm-constraints.py adr` — the rules the code must satisfy, generated from
   the Properties of the live ADRs. Nobody writes them; run it. Short by design: read all of it.
5. `adr/` — why each choice was made. **Never read the whole directory**, and usually do not
   read it at all: obeying a rule needs no reason. When you must argue with one, run the `trace`
   skill, which searches the ADRs in a subagent and returns the chain. Reading it by hand is
   `~/.claude/scripts/wm-adr-index.py adr` (add `-m <regex>` for your terms), then the title of
   each match, then only the ADRs that bear on your task.
6. `todos/TODO-N.md` — what to build, one increment at a time, and what proves it, then `todos/TODO-N.agent.md` — the files and pre-reads of each increment. Self-contained: read the pair and the generated rules alone, implement it alone.
7. `PATTERNS.md` — before writing code: the patterns that body's increments follow, and the files to pre-read.

Ignore `adr/archived/` unless you are auditing history. Those ADRs were deprecated or superseded.

## Write rules

- **Commit every change to this folder before the turn ends.** Run
  `jj -R <notes-dir> commit -m "<phase>: <main ideas>"` — a TODO, an ADR, `spec.md`, or
  `GLOSSARY.md` edit is not done until it is committed. The message says why, not which files.
  A Stop hook blocks the turn while changes are uncommitted.
- **Record every decision as an ADR with the `adr` skill, after the human approves it.** A new ADR
  is `proposed`; only the human sets `status: approved`, and no TODO is implemented before every
  live ADR has it. An open question is a section of `QUESTIONS.md`, never an ADR; the answer becomes
  an ADR and deletes the section. Never ask the same question in two sections.
- **Refine in place, reverse by supersede.** A new or reworded Property edits the ADR: bump
  `updated`, append a changelog line. A reversal is a new ADR that names the old one; the old one
  gets the changelog line `Superseded by [ADR-NNNN](../NNNN-slug.md)`, and a hook moves it to
  `adr/archived/`. Never renumber a
  Property; mark a dropped one `(dropped YYYY-MM-DD: <reason>)`.
- **A fact lives in `research/`** with its source. An ADR that rests on it links that file.
- **Decisions are not spec sections.** `spec.md` has no `Design Decisions` and no
  `Open Questions` — both live in `adr/`.
- **Patterns are not spec sections.** `spec.md` mentions `@PATTERNS.md`; the patterns and the
  reference files live there. A pattern with no example in the repo is a decision — `adr/`.
- **The ledger holds outcomes, not bodies.** No file paths, no checkboxes in `spec.md`.
- **Every new term goes in `GLOSSARY.md`** in the same edit that introduces it.
- **Spec scaffolding stays out of the code.** No TODO number, step number, wave, layer number, or
  file name from this corpus in source, identifiers, comments, or commit bodies. Name the work by
  its domain term: step 3 "calculate liabilities" becomes `calculateLiabilities` — never `step3`
  or "next step 4". If the step has no domain name, add one to `GLOSSARY.md` first.
- **Ask what `RULES.md` says to ask.** Do not decide alone what that file marks as human-owned.

## Status

`spec.md` frontmatter `status`: `init → review → impl`. Each `todos/TODO-N.md` frontmatter
`status`: `todo → impl → verify → done`, with `blocked` as the failure branch. `TODO-N.agent.md`
carries no frontmatter — the pair has one status.
An open question in `QUESTIONS.md` blocks the gate — list them with
`~/.claude/scripts/wm-open-questions.sh .`.
