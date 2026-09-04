# spec — revise

`revise` settles **drift** — notes-only, resets the spec frontmatter `status` to `review`. Use `fix` when code must change too.

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

Rewrites the notes so they match reality: an existing thought, a new one, and the `spec.md` /
`GLOSSARY.md` / `todos/TODO-N.md` + `TODO-N.agent.md` that depend on it. Two triggers:

1. **Review-phase correction** — a decision changed, a term sharpened, an outcome is wrong while the human reviews.
2. **Post-impl drift** — a TODO shipped code that differs from its body (files, extra refactor, renamed symbols, dropped step). Rewrite the notes to match what shipped so the target picture stays faithful.

A `## Deviations` table in `todos/TODO-N.md` is post-impl drift the implementer already wrote down: each row names the section it contradicts, what shipped, and the `impl-decision` note behind it (`impl:sub-impl.md` § When a correction contradicts the pair). Start Step 1 there — the deltas are listed for you.

## Guardrails

- Rewrite a diverged outcome to state what is now true; never delete it.
- Supersede a reversed thought (Step 3) — mark it and the hook moves it to `thoughts/archived/`; never delete it.
- Preserve TODO order and numbering.
- Confirm outcome-shifting or step-dropping edits with the user first — these change the spec contract.

## Step 1 — Scope the change

Name what it touches:

- **Thought** — the `thoughts/NNN-*.md` note(s) affected, or that a new one is needed.
- **Spec sections** — Description / Goal / ledger row(s) / `## Plan` waves / `GLOSSARY.md`. Decisions are never a spec section — they are thought notes (Step 3).
- **TODO bodies** — the pair: the `todos/TODO-N.md` outcome line and `## Surface`, and/or the `TODO-N.agent.md` `## Changes` increments. A rule the pair now breaks is not edited in the pair: the decision note's `description` is rewritten once, and every TODO obeying it follows.

For **post-impl drift**, locate TODO-N's commit(s) first (stop at first hit):

1. User-supplied SHA / range.
2. `git log --all --oneline --grep="TODO-N\b"`.
3. Notes jj history / `impl-learnings.md` entries pinning a SHA.
4. Exactly one commit between the previous TODO's commit and `HEAD` → assume it; else **ask**.

Inspect it (`git show --stat <sha>`, `git show <sha>`): files, symbols added/renamed, behavior added/removed, tests, what landed unplanned, what was planned but didn't land.

## Step 2 — Categorize each delta

| Category | Meaning | Action |
|----------|---------|--------|
| **Decision change** | A choice was made differently | Supersede the decision note (Step 3) and write the replacement's `description` as the new rule. The rule set follows on the next generator run — no row to rewrite, no `Origin` to repoint, and the superseded rule leaves the set when the hook archives its note |
| **New fact** | A constraint/observation surfaced | Write a new `fact` note (Step 3); link from the decisions it constrains |
| **Drift** | Impl differs from spec, outcome still met | Update `TODO-N.md` `## Surface` to the shipped signatures and `TODO-N.agent.md` `## Changes` to what was actually done |
| **Outcome shift** | The observable result changed | Rewrite the outcome row in spec.md AND the outcome line in TODO-N.md (verbatim match); update the thought that motivated it |
| **Scope creep** | Extra work landed / belongs elsewhere | Move it into that TODO, or add a new ledger entry in spec.md |
| **Missed step** | Planned work didn't land | Carry forward as a new ledger row, or drop it with a `thoughts/NNN-decision-*.md` note explaining why |

## Step 3 — Maintain the thought graph

Thoughts are the source the spec compiles from — keep them correct, not just the spec. Note format, filename, frontmatter, templates: `arch:ref-note-format.md`.

- **Change an existing thought** when the same decision/fact was refined: edit in place, add a one-line `Revised:` entry noting what changed and why.
- **Write a new thought** for a genuinely new decision or fact: next counter (`NNN`+1), matching example.
- **Supersede, don't delete** a reversed decision: write the replacement, then mark the old note `Superseded by [[NNN-decision-slug]]` at the top with `status: declined` and `superseded_by:` (`arch:ref-note-format.md` § Superseding). The `thoughts-archive.sh` hook moves it to `thoughts/archived/` — never `mv` it yourself. The live graph carries only current thoughts.
- **Re-link** per `arch:ref-note-format.md` § Back-linking (back-fill `Affects`, populate `links`, verify targets exist).

## Step 4 — Apply edits + reset status

`<notes-dir>/spec.md`:

- Update ledger row(s) per the deltas. No Design Decisions section exists — the choice lives in its thought note (Step 3).
- Refresh the **wave** table in `## Plan`: recompute waves from the current `depends_on` edges (`arch:ref-write.md` § Waves), keeping each wave as wide as the real edges allow.
- Set the frontmatter `status` to `review`.

`<notes-dir>/GLOSSARY.md`: add, rename, or reword terms per the deltas.

`<notes-dir>/todos/TODO-N.md`: restate the (possibly new) outcome verbatim at the top, and update `## Components` and `## Autotest` to the symbols and cases that are now true. `<notes-dir>/todos/TODO-N.agent.md`: rewrite `## Changes` and `## Files` to describe what is now true, still as **Do** prose and still with no diff. The shipped signatures go in the human half's `## Surface`; never paste a shipped body into either half (`arch:sub-todo.md` § A diff carries the surface, not a body). If the TODO diverged and must be re-implemented, set its frontmatter `status` back to `todo`.

`<notes-dir>/todos/TODO-N.md` `## Deviations`: fold every row into the section it names — the shipped shape becomes the approved shape — then delete the whole section. Its `impl-decision` notes stay live in `thoughts/`, where the `trace` skill still finds them; the table exists only while the pair still says something else.

Log to `<notes-dir>`; message: `"revise TODO-N (+ from <sha> if post-impl): <deltas + notes touched>"`.

## Step 5 — Report

```
Revised <TODO-N | spec section>  [from <sha> "<subject>"]
  status:   → review
  thoughts: <changed | added | superseded — note ids>
  outcome:  <unchanged | rewritten>
  spec:     <sections updated>
  todos:    <files / sections updated>
  deviations: <rows folded in and section deleted | none>
  rules:    <D-ids the generator now prints differently: added | reworded | gone>
  spinoffs: <new ledger entries, if any>
```

Then stop. The user owns the next action (re-review, continue impl, re-verify).

## Checklist

- [ ] Change scoped: thought note(s), spec sections, TODO bodies named
- [ ] (Post-impl) commit(s) for TODO-N located and SHA(s) recorded
- [ ] Deltas categorized (decision change / new fact / drift / outcome shift / scope creep / missed step)
- [ ] Thought graph maintained: notes changed/added/superseded, back-links + `links` updated, none deleted
- [ ] Every superseded note marked (`status: declined` + `superseded_by:`) and gone from `thoughts/` — the hook moved it; no live note links to an archived one
- [ ] Outcome-shifting or step-dropping edits confirmed with the user
- [ ] spec.md rows updated; `## Plan` wave table recomputed from `depends_on`
- [ ] `GLOSSARY.md` current
- [ ] spec.md frontmatter `status` set to `review`
- [ ] todos/TODO-N.md outcome, Components, Surface, and Autotest restated to the shipped signatures; TODO-N.agent.md `## Changes` + `## Files` match reality, still diff-free and carrying no shipped body
- [ ] Every `## Deviations` row folded into the section it names, and the section deleted
- [ ] `~/.claude/scripts/wm-constraints.py <notes-dir>/thoughts` re-run: every decision this revise settled prints as a rule, and every superseded one is gone
- [ ] jj commit created in `<notes-dir>`
- [ ] No edits outside `<notes-dir>/`
