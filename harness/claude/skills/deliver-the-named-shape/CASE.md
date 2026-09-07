# Cases

## 2026-08-03 — A shared p-frame constants module, enriched three times and stripped three times

- **Repo:** `~/git/mil/tasks/MILAB-6679-developability-designer/text` (corpus `work/projects/pframe-domain-modeling`), against `~/git/mil/tasks/.../platforma`
- **Task:** Specifying a shared constants package in the platforma repo holding every `pl7.app/…` identifier for both TypeScript and Tengo, so blocks reference declarations instead of typing string literals. The user's opening ask: "create the common package in the platforma repo that contains constant for all in ts and tengo language".
- **What I did:** Three separate enrichments of a flat constants list, each proposed as the design.
  1. Split the registry by spec position — `DomainAttribute` / `AnnotationAttribute` — mirroring the SDK's existing `Domain` / `Annotation` objects.
  2. After that was rejected, sketched an `Identifier` value object per entry (`canonical`, `aliases`, `matchers`, `pattern`, `identifiesKind`) plus two derived projections, `Attributes` and `Match`.
  3. Kept nested subgroups (`common`, `vdj`, `peptide`, `repertoire`, `rnaSeq`) after the value objects were rejected.
- **Correction:** three, in order:
  > export Attributes. That can be used in axis and domain and so on. It's the list of properties

  > nope, it's just a list of string. without aliases, matchers and another machinery

  > no subgroupt, every string is a new filed
- **Evidence:** The enrichment was not baseless — `platforma/lib/model/common/src/drivers/pframe/spec/spec.ts:74,123` really does declare `"pl7.app/alphabet"` twice, once in `Domain` and once in `Annotation`, and 14 blocks under `~/git/mil/1_blocks` really do carry both-spellings compat branches. Real problems; the user still wanted them solved by a flat list plus a lint rule, not by machinery in the module.
- **Ambiguous?** no — the ask named the shape three times in the user's own words ("list of properties", "just a list of string", "every string is a new field"). The enrichment was never a trade-off the user was weighing; it was structure I added.
- **Scope chosen:** global — row 1 of the Step 1 table. Teachable to a new colleague ("build the constants file they asked for"), and the situation recurs on any codebase where someone asks for constants, an enum, a glossary, or a lookup table. Nothing in the rule depends on this repo.
- **Rule written:** verdict — build the named artifact shape; where richer behavior seems needed, name the need in one sentence and let the user opt in, rather than shipping the mechanism inside the proposal.
- **Follow-on cost, which is why this was worth capturing:** an accepted decision atom (`attribute-registry`) recorded "grouping is by input kind: a common group plus one group per kind", and an earlier agreed ruling recorded legacy spellings as "queryable aliases, the package emits matchers". Both assumed machinery the user did not want, so both had to be withdrawn — one of them after acceptance, which costs a full revision round through the review gate.

## 2026-08-10 — "Make columns declarative" delivered twice, because the builder still added content

- **Repo:** ~/git/mil/tasks/MILAB-6679-developability-designer (block `1_blocks/antibody-variant-designer`)
- **Source:** correction — two rounds, one root cause
- **Task:** Writing `workflow/src/specs.lib.tengo`, the PColumn spec builder for a Platforma block: 15 emitted columns across two differently-keyed groups, plus a fixed-column synthesis CSV.
- **What I did:** First shape — a map of specs keyed by column id, plus three parallel ordered id arrays (`variantColumnIds`, `liabilityColumnIds`, `synthesisColumnIds`) that repeated those ids to fix emit order and CSV membership. After the first correction I turned each group into one ordered list of rows, but left `buildXsvColumns` injecting `pl7.app/blockId` into every column's domain and merging the row's own domain keys on top.
- **User's words:** > make columns declarative

  then, after the list rewrite:

  > that means no ant codee way domain adding and so on
- **Evidence:** the precedent I had copied puts the injection in the builder and even documents it — `1_blocks/3D-Structure-Based-Liabilities/workflow/src/specs.lib.tengo:345-357` ("Build the Xsv column[] entries with `pl7.app/blockId` injected into each column spec's domain"). Resolution: `variantColumns(blockId)` / `liabilityColumns(blockId)` return rows that spell their own full domain; `buildXsvColumns` maps a row to an xsv entry and merges nothing; the three id arrays are deleted, order comes from list position, and CSV membership/position are row fields (`csvHeader`, `csvOrder`) with asserts on duplicate and missing positions.
- **Ambiguous?** no — one right answer. The one judgement call was blockId, unknown until the run: making it a parameter of the table keeps every fact on the row, where injecting it does not. The operator picked that branch explicitly when offered both.
- **Scope chosen:** global — a declaration-table-plus-builder pair recurs in any codebase (spec builders, config tables, registries, fixtures), and the rule does not depend on Tengo or on Platforma.
- **Rule written:** verdict — extended `deliver-the-named-shape` with "When the named shape is a declaration table": the builder contributes nothing; an injected field becomes a parameter of the table, a merged default becomes a row field, and a parallel index list becomes list position plus a row field. Tell: if changing what ships needs an edit to the builder, the shape was not delivered.
- **Transcript:** /Users/vitaliipopov/.claude/self-improvement/lessons/2026-08-10-deliver-the-named-shape-72ab8ad4-b77e-4aaf-81a6-0ed2296b3ff5.jsonl
- **Session topic:** Antibody variant designer — the emitted PColumn specs and the synthesis CSV column set
