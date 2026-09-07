## 2026-09-03 — A frozen rejection enum gained a second writer, and the legend documented only the new branch

- **Repo:** /Users/vitaliipopov/git/mil/tasks/MILAB-6679-developability-designer (block `antibody-variant-designer`)
- **Source:** discovery — the outcome gate rejected the same sentence in three consecutive rounds
- **Task:** TODO-24 "report every objective that contributed nothing" — the rejection row gained an `objective` key, so `rejectedType` started describing objective contribution as well as parent/variant loss
- **What I did:** rewrote the legend at `ui/src/pages/RejectionCausesPage.vue:100-104` and the `RejectedType` doc at `model/src/types.ts:117-121` to the meaning the task intended — "a Variant row means the run shipped something without this objective's edit" — while `build_variants.py:206-210` writes `VARIANT_REJECTED` when `name in decline_by_objective` **or** `variants`. The `falls` fixture (`tests/test_humanness_objective_e2e.py:204-219`, humanization-only, gate refuses every edit set, nothing ships) asserts `VARIANT_REJECTED`, so a reader following the legend concludes a variant shipped.
- **User's words:** > § Surface froze "PARENT_REJECTED / VARIANT_REJECTED and everything rejectedType means", so the meaning may be widened by the new row kind, not replaced. Closing edit: state the union the code writes — `parent` = the run designed nothing for that clonotype; `variant` = a candidate was built and a gate turned it away, or the parent shipped a variant carrying no edit from this row's objective.
- **Evidence:** `software/developability/software/src/build_variants.py:208-212` (`if name in decline_by_objective or variants`) against `model/src/types.ts:117-121`; the gate blocked rounds 1, 2 and 3 on it and it is still open
- **Ambiguous?** no — the sentence must state what the code writes; the only branch point is whether a widened enum should instead gain a member, and the skill names it
- **Scope chosen:** global — enums documented from intent rather than from their write guards happen in every codebase, and the frozen-surface trigger is generic
- **Rule written:** verdict — grep every assignment of the value, state the union with the "or" visible, update every site carrying the sentence, and treat a contradicting committed fixture as the authority
- **Transcript:** not archived — captured from the TODO-24 gate history handed to this skill
- **Session topic:** TODO-24, report every objective that contributed nothing (wm-code-auto gate chain)
