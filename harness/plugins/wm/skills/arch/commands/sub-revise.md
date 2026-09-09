# spec — revise

`revise` settles **drift** in the notes only and resets `spec.md` to `status: review`. Use
`fix` when code changes too. Obey `code:ref-subcommand-rules.md`.

Treat a revision as one **delta manifest**, then patch only the stale artifact sections it names.
Two triggers:

1. **Review correction** — a decision, term, or outcome changes while the spec is reviewed.
2. **Post-impl drift** — shipped code differs from its TODO pair.

`TODO-N.md`'s `## Deviations` is already a delta manifest for post-impl drift. Start there.

## Guardrails

- Preserve TODO order and numbering.
- Keep an outcome that changed; rewrite it rather than deleting it.
- Confirm outcome shifts, dropped steps, and a human-made decision's supersession as
  `RULES.md` requires.

## Step 1 — Build the delta manifest

For each changed fact, record:

| Delta | Category | Canonical source | Stale derived sections |
|-------|----------|------------------|------------------------|
| `<what differs>` | `<category below>` | `<note / commit / ledger row>` | `<only sections that now disagree>` |

For post-impl drift, locate TODO-N's commit (first hit wins): user-supplied SHA or range; `git log
--all --oneline --grep="TODO-N\b"`; notes jj history or `impl-learnings.md`; or the sole commit
between the prior TODO commit and `HEAD`. Otherwise ask.

Read `git show --stat <sha>` and the deviations table first. Read `git show <sha> -- <path>` only
for a manifest row that is absent, ambiguous, or contradicted. The manifest is complete when every
delta has one category, one canonical source, and only its stale targets.

## Step 2 — Classify the deltas

| Category | Canonical change | Derived targets |
|----------|------------------|-----------------|
| **Decision change** | Replacement decision note supersedes the old note | Generated rules; only pairs whose instructions now disagree |
| **New fact** | New fact note | Notes or artifact sections that cite the fact |
| **Surface drift** | Shipped signature, path, or setting | `TODO-N.md` `## Surface`; agent `## Files` only if paths changed |
| **Behavior drift** | Shipped behavior or coverage | Autotest and agent `## Changes` only if their cases or increments disagree |
| **Outcome shift** | Ledger outcome and the thought that motivated it | Matching TODO outcome copy, affected plan row |
| **Scope change** | Ledger row added, moved, carried forward, or dropped with a decision | Ledger and Plan; affected TODO pairs |

The ledger outcome and its `TODO-N.md` Outcome are the one explicit derived copy in the corpus;
keep them verbatim. All other sections remain untouched unless the manifest names them.

## Step 3 — Patch thoughts adjacent to the delta

Thought format and links: `ref-note-format.md`.

- Refine a **fact** or non-semantic wording in place. Add `Revised:` only when its meaning changed.
- For a changed **decision rule**, write a replacement decision note, then supersede the old note;
  never edit its rule text in place.
- Write a new fact or decision only for a genuinely new fact or choice.
- Re-link edited notes and the archive hook's reported live-link worklist. A whole-graph link audit
  belongs to `verify`, not a local revision.

This step is done when every manifest note target is current and no live note links to one archived
by this revision.

## Step 4 — Patch derived artifacts once

- Update only the `spec.md` rows and sections listed by the manifest, then set `status: review`.
- Update `GLOSSARY.md` only for a changed term or definition.
- For each affected pair, update only the stale section: `Surface` for signatures; `Components`
  for changed symbols; `Autotest` for changed behavior or coverage; `Changes` or `Files` for
  changed implementation steps or paths.
- Fold each consumed `## Deviations` row into its named section, then remove that table when no row
  remains.
- Recompute the Plan waves only if a ledger row, `depends_on`, or a TODO `## Files` set changed
  (`ref-write.md` § Waves).
- Run `wm-constraints.py` only when a decision or implementation-decision rule changed.

Commit the completed revision once in `<notes-dir>`:
`revise TODO-N (+ from <sha> if post-impl): <deltas + notes touched>`.

## Step 5 — Report and stop

```
Revised <TODO-N | spec section>  [from <sha> "<subject>"]
  status:      → review
  manifest:    <N deltas; sections patched>
  thoughts:    <refined | added | superseded — ids>
  waves:       <recomputed | unchanged>
  rules:       <changed | unchanged>
  deviations:  <folded | none>
```

Stop. The user chooses re-review, re-verify, or implementation.

## Checklist

- [ ] Every delta has a category, canonical source, and stale targets
- [ ] A changed decision was replaced and superseded; facts or wording were refined in place only when valid
- [ ] Only manifest-named sections changed; ledger and TODO outcomes match verbatim where affected
- [ ] Waves, links, and generated rules were refreshed only when their inputs changed
- [ ] Deviations were folded; the completed revision has one jj commit
- [ ] No edits outside `<notes-dir>/`
