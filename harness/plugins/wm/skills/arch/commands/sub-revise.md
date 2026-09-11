# spec — revise

`revise` settles **drift** in the notes only and resets `spec.md` to `status: review`. Use
`fix` when code changes too. Obey `code:ref-subcommand-rules.md`.

Treat a revision as one **delta manifest**, then patch only the stale artifact sections it names.
Two triggers:

1. **Review correction** — a decision, term, or outcome changes while the spec is reviewed.
2. **Post-impl drift** — shipped code differs from its TODO pair.

`TODO-N.md`'s `## Deviations` is already a delta manifest for post-impl drift. Start there.

Each step below names its `wm:TOOLS.md` row — run the row rather than reading the corpus for what
a tool reports.

## Guardrails

- Preserve TODO order and numbering.
- Keep an outcome that changed; rewrite it rather than deleting it.
- Confirm outcome shifts, dropped steps, and a human-made decision's supersession as
  `RULES.md` requires.

## Step 1 — Read what moved since the last revision

Run `bin/notes-revision-diff.sh` over the row being revised, or over the whole corpus when the user
named no row (flags: `wm:TOOLS.md` § Ask why it is this way). The paths it prints
are the candidate stale sections — the previous revision's commit is the corpus's before-state, so
the diff answers "what disagrees now" without opening an artifact.

- No prior revision to diff: the deviations table and the code commit are the only sources.
- No jj repo under the notes: say so rather than falling back to a corpus-wide read.

## Step 2 — Build the delta manifest

For each changed fact, record:

| Delta | Category | Canonical source | Stale derived sections |
|-------|----------|------------------|------------------------|
| `<what differs>` | `<category below>` | `<note / commit / ledger row>` | `<only sections that now disagree>` |

Fill the last column from Step 1's paths, not from a read.

For post-impl drift, locate TODO-N's commit (first hit wins): user-supplied SHA or range; `git log
--all --oneline --grep="TODO-N\b"`; `jj -R <notes-dir> log` or `impl-learnings.md`; or the sole
commit between the prior TODO commit and `HEAD`. Otherwise ask.

Read `git show --stat <sha>` and the deviations table first. Read `git show <sha> -- <path>` only
for a manifest row that is absent, ambiguous, or contradicted. The manifest is complete when every
delta has one category, one canonical source, and only its stale targets.

## Step 3 — Classify the deltas

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

## Step 4 — Patch thoughts adjacent to the delta

Thought format and links: `ref-note-format.md`. Find the notes through `wm:TOOLS.md` § Find a
thought.

- **A delta that argues with a note goes to `trace` first.** Spawn `wm:tracer` with the anchor
  quoted verbatim; its `superseded` verdict already names the replacement, and `unrecorded` means
  the note must be written before the decision is made. Never reconstruct the chain by reading.
- Refine a **fact** or non-semantic wording in place. Add `Revised:` only when its meaning changed.
- For a changed **decision rule**, write a replacement decision note, then supersede the old note;
  never edit its rule text in place.
- Write a new fact or decision only for a genuinely new fact or choice.
- Re-link edited notes and the archive hook's reported live-link worklist in one run
  (`wm:TOOLS.md` § Patch an artifact) — one edge line per link. A whole-graph link audit belongs to
  `verify`, not a local revision.

This step is done when every manifest note target is current and no live note links to one archived
by this revision.

## Step 5 — Patch derived artifacts once

Patch by named section, and a one-off passage by exact text (`wm:TOOLS.md` § Patch an artifact).
Both tools fail unless the target matches exactly once, which is what keeps a patch inside the
section the manifest named.

- Update only the `spec.md` rows and sections listed by the manifest, then set `status: review`.
- Update `GLOSSARY.md` only for a changed term or definition.
- For each affected pair, update only the stale section: `Surface` for signatures; `Components`
  for changed symbols; `Autotest` for changed behavior or coverage; `Changes` or `Files` for
  changed implementation steps or paths.
- Fold each consumed `## Deviations` row into its named section, then remove that table when no row
  remains.
- Recompute the Plan waves only if a ledger row, `depends_on`, or a TODO `## Files` set changed
  (`ref-write.md` § Waves).
- Regenerate the rules only when a decision or implementation-decision rule changed
  (`wm:TOOLS.md` § Obey the corpus).

Commit the completed revision once in `<notes-dir>`:
`revise TODO-N (+ from <sha> if post-impl): <deltas + notes touched>`. The `revise` prefix is
load-bearing — `code:ref-jj-notes.md` § Message convention.

## Step 6 — Report and stop

```
Revised <TODO-N | spec section>  [from <sha> "<subject>"]
  since:       <base change "<subject>" | no prior revision>
  status:      → review
  manifest:    <N deltas; sections patched>
  thoughts:    <refined | added | superseded — ids>
  waves:       <recomputed | unchanged>
  rules:       <changed | unchanged>
  deviations:  <folded | none>
```

Stop. The user chooses re-review, re-verify, or implementation.

## Checklist

- [ ] The stale-section column came from the revision diff, not from a corpus read
- [ ] Every delta has a category, canonical source, and stale targets
- [ ] A changed decision was replaced and superseded; facts or wording were refined in place only when valid
- [ ] Only manifest-named sections changed; ledger and TODO outcomes match verbatim where affected
- [ ] Waves, links, and generated rules were refreshed only when their inputs changed
- [ ] Deviations were folded; the completed revision has one jj commit
- [ ] No edits outside `<notes-dir>/`
