# Cases

## 2026-08-26 — Weight fields rendered empty on a project saved before they existed

- **Repo:** /Users/vitaliipopov/git/mil/tasks/MILAB-6679-developability-designer/1_blocks/antibody-variant-designer
- **Source:** correction — the user twice asked for the fields to show their defaults
- **Task:** two new block args (`wStruct`, `wObj`) had shipped; the operator opened Settings on an existing project and saw two blank number fields
- **What I did:** first seeded every missing field from the defaults table into `app.model.data` on setup — which fixed the display by writing persisted project state as a side effect of opening the panel
- **User's words:** > should have default on UI level … [after a review gate removed the seeding loop] No empty fields
- **Evidence:** an opus review gate flagged the seeding loop — "it writes into persisted project state as a side effect of opening the settings panel on a legacy project"; the block's args are the run's content key, so that write invalidates the run. Shipped in fixup 155d8b3 as one writable computed per field. The same absent-field bug crashed `isFixabilityChecked` (`.includes()` on `undefined`).
- **Ambiguous?** no — the display must show the effective value and the write must wait for an edit; both hold at once
- **Scope chosen:** global — any settings UI over per-user or per-document persisted state hits this the first time a field is added. The Platforma specifics (`app.model.data`, `.args()`) are named as the anchor, not as the rule
- **Rule written:** verdict — bind each defaulted control through a writable computed whose getter falls back to the defaults table; never seed persisted state to fix a display
- **Transcript:** not archived — captured live during /code squash
- **Session topic:** MILAB-6679 humanization objective, TODO-18/19/20

## 2026-09-03 — A renamed edit cap displayed the default while the run used the legacy value

- **Repo:** /Users/vitaliipopov/git/mil/tasks/MILAB-6679-developability-designer/1_blocks/antibody-variant-designer
- **Source:** discovery — a review gate raised it as a defect and the call was deferred, which is itself the lesson
- **Task:** TODO-22 split one `maxEditsPerVariant` cap into `maxLiabilityEdits` + `maxFrameworkEdits`; `model/src/index.ts:215` reads `data.maxLiabilityEdits ?? data.maxEditsPerVariant ?? 10`
- **What I did:** bound the new liability field through the same `defaulted()` helper as every other field, which reads `data.maxLiabilityEdits ?? BLOCK_DATA_DEFAULTS.maxLiabilityEdits` and never the legacy key — so a project saved with `maxEditsPerVariant: 5` opens showing 10 while every run caps at 5
- **User's words:** > (none — the outcome gate's finding) "the displayed setting is not the effective one, and it stays wrong until the operator happens to touch that field"
- **Evidence:** `ui/src/components/BlockSettings.vue:101-107` vs `model/src/index.ts:215`; `dataModel.init()` (`model/src/index.ts:63-68`) seeds defaults for new projects only. The same gap rides on the four earlier renames (`frConfThresh`, `cdrConfThresh`, `wStruct`, `wObj`), which is why it was not treated as a TODO-22 regression
- **Ambiguous?** yes — the alternative is that the panel never reads legacy keys and the design note plus the manual-test row must say so; the gate marked that branch a spec revision, not a code fix, and no fixup was committed
- **Scope chosen:** global — same skill, second case: the first was a field *added*, this one a field *renamed*, and the defaults helper silently covers only the first
- **Rule written:** check — added the third trap: when the run's projection carries a `?? legacyKey` term, decide out loud whether the control mirrors it or the note documents the mismatch
- **Transcript:** not archived — captured inside the /code auto gate loop for TODO-22
- **Session topic:** MILAB-6679 humanization objective, TODO-22 (split the single edit cap into two)

