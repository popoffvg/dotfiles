# spec — revise

## Purpose

Fix the spec artifacts — `spec.md`, `GLOSSARY.md`, `todos/TODO-N.md`, and the `thoughts/` graph — when they
no longer match reality or a decision changed. Revise **changes an existing thought note or
writes a new one** as the fix demands, then updates the spec/TODOs that depend on it. It is the
settle action of the **review** phase: any `revise` call resets the spec header `Status` to
`review`.

Two triggers:

1. **Review-phase correction** — while the human reviews the spec (or its TODOs), a decision
   changes, a term sharpens, an outcome is wrong. Revise settles it in the notes.
2. **Post-impl divergence** — a TODO shipped code that differs from its body (different files,
   extra refactor, renamed symbols, dropped step). Revise rewrites the spec/TODO/thoughts to
   match what shipped, so the spec stays a faithful target picture.

**Revise is notes-only.** It never edits source code. To change a thought *and* the code it
governs, use `fix` (which corrects the thought, then the code).

## CRITICAL RULES

- **Read-only on source code.** Edits limited to `<notes-dir>/spec.md`, `<notes-dir>/GLOSSARY.md`,
  `<notes-dir>/todos/TODO-N.md`, `<notes-dir>/thoughts/*.md`, and the notes' jj history
  (`jj commit` in `<notes-dir>`).
- Never reorder or renumber unrelated TODOs.
- Never delete a TODO outcome — if it diverged, **rewrite** the outcome to describe what is now true.
- Never delete a thought note — supersede it (see Step 3).
- Confirm outcome-shifting or step-dropping edits with the user before applying — these change the spec contract.

## Step 1 — Scope the change

Identify what triggered the revise and what it touches:

- **Which decision/fact changed?** Name the `thoughts/NNN-*.md` note(s) it affects, or note that a new one is needed.
- **Which spec sections?** Description / Design Decisions / Goal / TODO List row(s) / `GLOSSARY.md`.
- **Which TODO bodies?** `todos/TODO-N.md` — outcome line and/or `## Changes`.

For a **post-impl divergence**, first locate the commit(s) for TODO-N (stop at first hit):

1. User-supplied SHA / range.
2. `git log --all --oneline --grep="TODO-N\b"`.
3. Notes jj history / `impl-learnings.md` entries pinning a SHA.
4. If exactly one commit sits between the previous TODO's commit and `HEAD`, assume it — else **ask**, don't guess.

Then inspect it (`git show --stat <sha>`, `git show <sha>`): files touched, symbols added/renamed, behavior added/removed, tests, what landed that wasn't planned, what was planned that didn't land.

## Step 2 — Categorize each delta

| Category | Meaning | Action |
|----------|---------|--------|
| **Decision change** | A choice was made differently | Supersede the decision note (Step 3); update spec.md **Design Decisions** |
| **New fact** | A constraint/observation surfaced | Write a new `fact` note (Step 3); link from the decisions it constrains |
| **Drift** | Impl differs from spec, outcome still met | Update TODO body `## Changes` to match reality |
| **Outcome shift** | The observable result changed | Rewrite the outcome row in spec.md AND the outcome line in TODO-N.md (verbatim match); update the thought that motivated it |
| **Scope creep** | Extra work landed / belongs elsewhere | Move it into that TODO, or add a new TODO row in spec.md |
| **Missed step** | Planned work didn't land | Carry forward as a new TODO row, or drop it with a Design Decision note explaining why |

## Step 3 — Maintain the thought graph

Thoughts are the source of truth the spec is compiled from — keep them correct, not just the spec.

- **Change an existing thought** when the same decision/fact was refined: edit the note in place, and add a one-line `Revised:` entry in its body noting what changed and why.
- **Write a new thought** when a genuinely new decision or fact appears. Use the note counter (highest existing `NNN` + 1) and the right template (`references/note-template-{decision,fact}.md`). Format: `references/note-format.md`.
- **Supersede, don't delete** a reversed decision: keep the old note, mark it `Superseded by [[NNN-decision-slug]]` at the top, and write the replacement note.
- **Re-link**: for every `Depends on` in a new/changed note pointing to note A, add the matching `Affects` back-link in A. Populate the `links` frontmatter with all `[[wikilinks]]` in the body. Verify every wikilink target exists.

## Step 4 — Apply edits + advance status

In `<notes-dir>/spec.md`:

- Update the TODO List row(s) and Design Decisions as the deltas require.
- Refresh the **Decision trail** table in `## Plan` so it still mirrors `thoughts/`.
- **Set the header `Status:` field to `review`** — revising returns the spec to the review phase regardless of its prior status.

In `<notes-dir>/GLOSSARY.md`:

- Add, rename, or reword terms as the deltas require. Keep it current — revise is one of the phases responsible for this.

In `<notes-dir>/todos/TODO-N.md`:

- Restate the (possibly new) outcome verbatim at the top.
- Rewrite `## Changes` (TS pseudocode per `flow`) to describe what is now true; update files, symbols, acceptance criteria.

In `<notes-dir>`:

- Run `jj commit -m "revise TODO-N (+ from <sha> if post-impl): <one-line summary of the deltas + thought notes touched>"`.

## Step 5 — Report

```
Revised <TODO-N | spec section>  [from <sha> "<subject>"]
  status:   → review
  thoughts: <changed | added | superseded — note ids>
  outcome:  <unchanged | rewritten>
  spec:     <sections updated>
  todos:    <files / sections updated>
  spinoffs: <new TODO rows, if any>
```

Then stop. The user owns the next action (re-review, continue impl, re-verify).

## Checklist

- [ ] Change scoped: affected thought note(s), spec sections, TODO bodies identified
- [ ] (Post-impl) commit(s) for TODO-N located and SHA(s) recorded
- [ ] Deltas categorized (decision change / new fact / drift / outcome shift / scope creep / missed step)
- [ ] Thought graph maintained: notes changed/added/superseded, back-links and `links` frontmatter updated, no note deleted
- [ ] Outcome-shifting or step-dropping edits confirmed with the user
- [ ] spec.md rows/decisions updated; `## Plan` decision trail refreshed
- [ ] `GLOSSARY.md` current with the deltas
- [ ] spec.md header `Status` set to `review`
- [ ] todos/TODO-N.md outcome restated; `## Changes` matches reality
- [ ] jj commit created in `<notes-dir>`
- [ ] No edits outside `<notes-dir>/`
