# spec — revise

`revise` settles **drift** — notes-only, resets the spec frontmatter `status` to `review`. Use `fix` when code must change too.

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

Rewrites the notes so they match reality: an existing thought, a new one, and the `spec.md` /
`GLOSSARY.md` / `todos/TODO-N.md` that depend on it. Two triggers:

1. **Review-phase correction** — a decision changed, a term sharpened, an outcome is wrong while the human reviews.
2. **Post-impl drift** — a TODO shipped code that differs from its body (files, extra refactor, renamed symbols, dropped step). Rewrite the notes to match what shipped so the target picture stays faithful.

## Guardrails

- Rewrite a diverged outcome to state what is now true; never delete it.
- Supersede a reversed thought (Step 3) and move it to `thoughts/archived/`; never delete it.
- Preserve TODO order and numbering.
- Confirm outcome-shifting or step-dropping edits with the user first — these change the spec contract.

## Step 1 — Scope the change

Name what it touches:

- **Thought** — the `thoughts/NNN-*.md` note(s) affected, or that a new one is needed.
- **Spec sections** — Description / Goal / ledger row(s) / `## Plan` waves / `GLOSSARY.md`. Decisions are never a spec section — they are thought notes (Step 3).
- **TODO bodies** — `todos/TODO-N.md` outcome line and/or `## Changes`.

For **post-impl drift**, locate TODO-N's commit(s) first (stop at first hit):

1. User-supplied SHA / range.
2. `git log --all --oneline --grep="TODO-N\b"`.
3. Notes jj history / `impl-learnings.md` entries pinning a SHA.
4. Exactly one commit between the previous TODO's commit and `HEAD` → assume it; else **ask**.

Inspect it (`git show --stat <sha>`, `git show <sha>`): files, symbols added/renamed, behavior added/removed, tests, what landed unplanned, what was planned but didn't land.

## Step 2 — Categorize each delta

| Category | Meaning | Action |
|----------|---------|--------|
| **Decision change** | A choice was made differently | Supersede the decision note (Step 3); restate the new constraint in the `## Constraints` of each TODO whose increments can violate it, and delete the stale row wherever it no longer binds |
| **New fact** | A constraint/observation surfaced | Write a new `fact` note (Step 3); link from the decisions it constrains |
| **Drift** | Impl differs from spec, outcome still met | Update TODO body `## Changes` to match reality |
| **Outcome shift** | The observable result changed | Rewrite the outcome row in spec.md AND the outcome line in TODO-N.md (verbatim match); update the thought that motivated it |
| **Scope creep** | Extra work landed / belongs elsewhere | Move it into that TODO, or add a new ledger entry in spec.md |
| **Missed step** | Planned work didn't land | Carry forward as a new ledger row, or drop it with a `thoughts/NNN-decision-*.md` note explaining why |

## Step 3 — Maintain the thought graph

Thoughts are the source the spec compiles from — keep them correct, not just the spec. Note format, filename, frontmatter, templates: `ref-note-format.md`.

- **Change an existing thought** when the same decision/fact was refined: edit in place, add a one-line `Revised:` entry noting what changed and why.
- **Write a new thought** for a genuinely new decision or fact: next counter (`NNN`+1), matching template.
- **Supersede, don't delete** a reversed decision: write the replacement, mark the old note `Superseded by [[NNN-decision-slug]]` at the top with `status: declined`, then **move the old file to `thoughts/archived/`** (`ref-note-format.md` § Superseding). The live graph carries only current thoughts.
- **Re-link** per `ref-note-format.md` § Back-linking (back-fill `Affects`, populate `links`, verify targets exist).

## Step 4 — Apply edits + reset status

`<notes-dir>/spec.md`:

- Update ledger row(s) per the deltas. No Design Decisions section exists — the choice lives in its thought note (Step 3).
- Refresh the **wave** table in `## Plan`: recompute waves from the current `depends_on` edges (`ref-write.md` § Waves), keeping each wave as wide as the real edges allow.
- Set the frontmatter `status` to `review`.

`<notes-dir>/GLOSSARY.md`: add, rename, or reword terms per the deltas.

`<notes-dir>/todos/TODO-N.md`: restate the (possibly new) outcome verbatim at the top; rewrite `## Changes` to describe what is now true — files, symbols, acceptance criteria. If the TODO diverged and must be re-implemented, set its frontmatter `status` back to `todo`.

Log to `<notes-dir>`; message: `"revise TODO-N (+ from <sha> if post-impl): <deltas + notes touched>"`.

## Step 5 — Report

```
Revised <TODO-N | spec section>  [from <sha> "<subject>"]
  status:   → review
  thoughts: <changed | added | superseded — note ids>
  outcome:  <unchanged | rewritten>
  spec:     <sections updated>
  todos:    <files / sections updated>
  spinoffs: <new ledger entries, if any>
```

Then stop. The user owns the next action (re-review, continue impl, re-verify).

## Checklist

- [ ] Change scoped: thought note(s), spec sections, TODO bodies named
- [ ] (Post-impl) commit(s) for TODO-N located and SHA(s) recorded
- [ ] Deltas categorized (decision change / new fact / drift / outcome shift / scope creep / missed step)
- [ ] Thought graph maintained: notes changed/added/superseded, back-links + `links` updated, none deleted
- [ ] Every superseded note moved to `thoughts/archived/`; no live note links to an archived one
- [ ] Outcome-shifting or step-dropping edits confirmed with the user
- [ ] spec.md rows updated; `## Plan` wave table recomputed from `depends_on`
- [ ] `GLOSSARY.md` current
- [ ] spec.md frontmatter `status` set to `review`
- [ ] todos/TODO-N.md outcome restated; `## Changes` matches reality
- [ ] jj commit created in `<notes-dir>`
- [ ] No edits outside `<notes-dir>/`
