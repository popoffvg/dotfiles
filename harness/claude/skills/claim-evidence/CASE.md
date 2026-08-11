# Cases

## 2026-08-10 — The user asked about `file:71` and my in-context Read of that file was stale

- **Repo:** `~/git/mil/tasks/MILAB-6679-developability-designer/1_blocks/antibody-variant-designer`
- **Source:** discovery — the file changed under me mid-session and my first instinct was to answer from the earlier Read
- **Task:** answering "specs.lib.tengo:71 what is it?"
- **What I did:** I had read the whole file earlier in the same session, where line 71 was a blank line between two constants. My first reasoning was that the user must mean line 70 (`BINDING_RISK_DEFAULT_CUTOFF`) and that 71 was empty. I re-read before answering and found the file had been refactored: the header comment shrank, `csvOrder` was deleted in favour of list order, `variantSequence` moved from fifth to first, and line 71 was now `column: "variantSequence",`. Answering from context would have told the user their own line number was wrong.
- **User's words:** > 1_blocks/antibody-variant-designer/workflow/src/specs.lib.tengo:71 what is it?
- **Evidence:** the fresh Read returned `71	column: "variantSequence",` inside `variantColumns` (`:61-84`); my earlier read of the same path had `71` blank and `variantColumns` starting at `:81`. A `system-reminder` in the same turn confirmed an unrelated file had also been edited by the user or a linter, so mid-session edits were live.
- **Ambiguous?** no — one right answer. A user-supplied line number is current by construction; an in-context Read is a snapshot.
- **Scope chosen:** global — Step 1 row 1. Long sessions plus a user editing alongside the agent is the normal case in any repo, and every line below an edit shifts.
- **Rule written:** verdict — new **line number** row in the claim table: re-read the exact range before quoting or correcting a `file:line`, and never correct the user's line number from a stale read.
- **Transcript:** `/Users/vitaliipopov/.claude/self-improvement/lessons/2026-08-10-contextdomain-spec-validation-a3730795-5e10-4b82-b08b-77c37fa37a40.jsonl`
- **Session topic:** Find contextDomain usage and domain reflection

## 2026-08-10 — A schema validator PASSed a spec carrying a key the schema does not define

- **Repo:** `~/git/mil/tasks/MILAB-6679-developability-designer/platforma` (+ `/1_blocks/antibody-variant-designer`)
- **Source:** discovery — an experiment contradicted my default assumption about what a validator PASS proves
- **Task:** answering "is this a valid spec?" about a PColumn declaration in a Platforma block (`workflow/src/specs.lib.tengo:243-252`)
- **What I did:** ran the real SDK validator — `validation.assertType(cfg, util.PFCONV_IMPORT_CFG_SCHEMA)`, the same call `xsv.importFile` makes — got `PASS`, and was about to report the spec valid on that basis alone. My default assumption was that a schema PASS meant full conformance, stray keys included.
- **User's words:** > (no user statement — the lesson came from the negative control I ran on my own claim)
- **Evidence:** negative control 1, adding a key the schema does not define, **PASSED**: `cfg.columns[1].spec.kind = "PColumn"` → `PASS: TestNegativeControl`. Negative control 2, an illegal *value*, correctly FAILED: `cfg.columns[1].spec.valueType = "Boolean"` → `"type schema validation error: columns[1].spec.valueType: value \"Boolean\" does not conform regex \"Int|Long|Float|Double|String\""` (`platforma/sdk/workflow-tengo/src/validation.lib.tengo:397`). So `assertType` checks the type of every present key and ignores unknown ones.
- **Ambiguous?** no — one right answer. A validator PASS is only as wide as a matching negative control makes it, always.
- **Scope chosen:** global — Step 1 row 1. Schema and type validators ignoring unknown keys is the norm, not a Platforma quirk (JSON Schema without `additionalProperties: false`, Go `encoding/json`, pydantic's default `extra="ignore"`, protobuf unknown fields). Teachable to any new colleague.
- **Rule written:** verdict — new **validator PASS** row in the claim table: a PASS says every present key is legal, not that no key is stray; run a negative control on the exact thing you claim was checked, and state the claim only at the width the control established. Added `"it validates"` to the `description` trigger list.
- **Transcript:** `/Users/vitaliipopov/.claude/self-improvement/lessons/2026-08-10-contextdomain-spec-validation-a3730795-5e10-4b82-b08b-77c37fa37a40.jsonl`
- **Session topic:** Find contextDomain usage and domain reflection

## 2026-08-10 — Called two PColumn groups "what the block emits" when nothing calls the builders

- **Repo:** `~/git/mil/tasks/MILAB-6679-developability-designer` (block `1_blocks/antibody-variant-designer`)
- **Source:** correction — the user pushed back on my answer
- **Task:** explaining why the block's liability table carries a `liabilityKey` axis next to `variantKey`
- **What I did:** read only `workflow/src/specs.lib.tengo` (axis specs at `:15-32`, the two `xsv.importFile` settings builders at `:352-376`) and wrote "The block emits two column groups". I never checked whether any template calls those builders.
- **User's words:** > are you sure. Block should produce in the and new antibody. Where that axeses live?
- **Evidence:** `workflow/src/main.tpl.tengo:5-10` returns `outputs: {}, exports: {}`; the only callers of `buildVariantsXsvSettings` / `buildLiabilitiesXsvSettings` are `workflow/src/specs.test.tengo:30,49,64,101,126,143,183`; no `xsv.importFile` call exists in any `.tpl.tengo` in the block.
- **Ambiguous?** no — one right answer. A declaration with no live caller is not production, in any language.
- **Scope chosen:** global — Step 1 row 1. Mistaking a definition for a running behavior happens in every codebase, and mid-implementation repos where specs land before the wiring are the normal case.
- **Rule written:** verdict — new **production** row in the claim table: trace an "it emits / exports / publishes" claim from the declaration to a live caller reached from the runtime entry point; when only tests call it, write "declared, not wired".
- **Transcript:** `/Users/vitaliipopov/.claude/self-improvement/lessons/2026-08-10-session-d6c1fc10-6277-4f6c-8fcb-d4c4e3d08f6a.jsonl`
- **Session topic:** why the liability axis exists alongside the variant axis
