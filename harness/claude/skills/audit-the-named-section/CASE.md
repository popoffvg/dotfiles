# Cases

## 2026-08-03 — Widened a "duplication across domains" audit to three catalog sections

- **Repo:** `~/git/mil/tasks/MILAB-6679-developability-designer`
- **Task:** "read p-column-spec-catalogue and find duplication accross domains" against
  `vault/15-Pl-Terms/P-Column Spec Catalog.md`, which has three key sections — Axes (`:43-116`),
  Domain keys (`:120-254`), Annotation keys (`:256-347`).
- **What I did:** Read "domains" as broadly as possible and audited all three sections. Reported
  24 groups, but a third of them were cross-section (12 keys living in both the domain map and
  the annotation map, an axis-list appendix, annotation rows quoted inside domain findings).
- **Correction:** > I work only withe Domain keys section
- **Evidence:** Rescoping to `:120-254` alone found **five groups the wide pass had missed**,
  all of which required reading the 76 domain rows as one unit: the `opaque-id` role owns 15 of
  76 keys (20% of the vocabulary); five keys have exactly one possible value so they discriminate
  nothing, against the section's own contract at `:122-123` ("different domain ⇒ different
  concept"); a boolean is encoded three ways (`true`/`false` at `:217`, `_bool-as-string_` at
  `:237`, present-or-absent at `:202`); gzip is encoded twice — `pl7.app/fileExtension` carries
  `.gz` in 8 of 11 values while `pl7.app/compression` `:244` duplicates it, and
  `import-sc-rnaseq-data/workflow/src/libs/input-utils.lib.tengo:63-66` writes it as `""`, a
  third state; `pl7.app/species` `:235` mixes `human` with `homo-sapiens` / `hsa` at 23 uses in
  11 blocks, a live matching bug rather than debt. A scope check on the rewrite confirmed
  `lines cited outside Domain-keys section (120-254): none`.
- **Ambiguous?** no — one right answer for the procedure. The word "domains" was genuinely
  ambiguous (the Domain keys section, or "across the input kinds"), but the correct response to
  that ambiguity is to audit the named subdivision first and state the reading, not to widen.
  Widening produced a shallower pass under *both* readings.
- **Scope chosen:** global — Step 1 row 1. Worth teaching anyone: audit the section that was
  named. Recurs on any sectioned corpus (spec, workbook sheet, config block, monorepo package),
  not just this catalog.
- **Rule written:** verdict — fix the section's line range before reading, sweep it
  exhaustively, check the section's own stated contract, push cross-section findings to a
  labeled out-of-scope appendix, and assert mechanically that no cited line falls outside the
  range.
