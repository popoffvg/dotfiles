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
| `<what differs>` | `<category below>` | `<ADR / commit / ledger row>` | `<only sections that now disagree>` |

Fill the last column from Step 1's paths, not from a read.

For post-impl drift, locate TODO-N's commit (first hit wins): user-supplied SHA or range; `git log
--all --oneline --grep="TODO-N\b"`; `jj -R <notes-dir> log` or `<notes-dir>/LESSONS.md`; or the sole
commit between the prior TODO commit and `HEAD`. Otherwise ask.

Read `git show --stat <sha>` and the deviations table first. Read `git show <sha> -- <path>` only
for a manifest row that is absent, ambiguous, or contradicted. The manifest is complete when every
delta has one category, one canonical source, and only its stale targets.

## Step 3 — Classify the deltas

| Category | Canonical change | Derived targets |
|----------|------------------|-----------------|
| **Decision change** | Refined ADR, or a new ADR that supersedes the old one | Generated rules; only pairs whose instructions now disagree |
| **New fact** | The research artifact that holds the fact | ADRs or artifact sections that cite it |
| **Surface drift** | Shipped signature, path, or setting | the **Surface** diff of the `TODO-N.md` increment that lands it; agent `## Files` only if paths changed |
| **Behavior drift** | Shipped behavior or coverage | Autotest and `TODO-N.md` `## Increments` only if their cases or increments disagree |
| **Outcome shift** | Ledger outcome and the ADR that motivated it | Matching TODO outcome copy, affected plan row |
| **Scope change** | Ledger row added, moved, carried forward, or dropped with a decision | Ledger and Plan; affected TODO pairs |

The ledger outcome and its `TODO-N.md` Outcome are the one explicit derived copy in the corpus;
keep them verbatim. All other sections remain untouched unless the manifest names them.

## Step 4 — Patch ADRs adjacent to the delta

ADR rules: `ref-adr-format.md`. Find the ADRs through `ref-adr-format.md` § Find the ADRs for a task.

- **A delta that argues with an ADR goes to `trace` first.** Spawn `wm:tracer` with the anchor
  quoted verbatim; its `superseded` verdict already names the replacement, and `unrecorded` means
  the ADR must be written before the decision is made. Never reconstruct the chain by reading.
- Refine an ADR in place: add or reword a Property, or mark one dropped, then bump `updated` and
  append a changelog line. A reversed decision is a new ADR that supersedes the old one
  (`ref-adr-format.md` § Refine in place, reverse by supersede). A term rename goes through
  `~/.claude/scripts/rename-token.sh`.
- A changed fact is patched in the research artifact that holds it.
- Record a new ADR with the `adr` skill only for a genuinely new choice.
- Repoint the links on the archive hook's reported worklist in one run
  (`wm:TOOLS.md` § Patch an artifact). A whole-corpus link audit belongs to `verify`, not a local
  revision.

This step is done when every manifest ADR target is current and no live ADR links to one archived
by this revision.

## Step 5 — Patch derived artifacts once

Patch by named section, and a one-off passage by exact text (`wm:TOOLS.md` § Patch an artifact).
Both tools fail unless the target matches exactly once, which is what keeps a patch inside the
section the manifest named.

- Update only the `spec.md` rows and sections listed by the manifest, then set `status: review`.
- Update `GLOSSARY.md` for a changed term or definition, and retire every entry whose concept the change drops or replaces — `Status: retired` with `Replaced by` — then sweep the old names (`code:ref-subcommand-rules.md` § Glossary). Run `${CLAUDE_PLUGIN_ROOT}/bin/glossary-lint.py <notes-dir>` before the commit.
- For each affected pair, update only the stale section: an increment's **Surface** diff for signatures; `Components`
  for changed symbols; `Flow changes` for a changed step or check; `TODO-N.test.md` `Autotest` for changed behavior or coverage; `Increments` or `Files` for
  changed implementation steps or paths.
- Fold each consumed `## Deviations` row into its named section, then remove that table when no row
  remains. **Check every row carries its `[ADR-NNNN](../adr/NNNN-slug.md)` link before you delete one.**
  Deleting the table is what makes the ADR the only surviving record of the correction; a row with
  an empty ADR column has no such record, so record the ADR first and fold second.
- Recompute the Plan waves only if a ledger row, `depends_on`, or a TODO `## Files` set changed
  (`ref-write.md` § Waves).
- Regenerate the rules only when a Property of an ADR changed
  (`wm:TOOLS.md` § Obey the corpus).

Commit the completed revision once in `<notes-dir>`:
`revise TODO-N (+ from <sha> if post-impl): <deltas + ADRs touched>`. The `revise` prefix is
load-bearing — `code:ref-jj-notes.md` § Message convention.

## Step 6 — Report and stop

```
Revised <TODO-N | spec section>  [from <sha> "<subject>"]
  since:       <base change "<subject>" | no prior revision>
  status:      → review
  manifest:    <N deltas; sections patched>
  adrs:        <refined | added | superseded — ADR-NNNN>
  waves:       <recomputed | unchanged>
  rules:       <changed | unchanged>
  deviations:  <folded | none>
```

Stop. The user chooses re-review, re-verify, or implementation.

## Checklist

- [ ] The stale-section column came from the revision diff, not from a corpus read
- [ ] Every delta has a category, canonical source, and stale targets
- [ ] A refined decision was edited in place with a changelog line; a reversed decision was superseded by a new ADR; a changed fact was patched in its research artifact
- [ ] Only manifest-named sections changed; ledger and TODO outcomes match verbatim where affected
- [ ] Waves, links, and generated rules were refreshed only when their inputs changed
- [ ] Deviations were folded; the completed revision has one jj commit
- [ ] No edits outside `<notes-dir>/`
