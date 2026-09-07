## 2026-09-03 — Two pipeline steps wrote the same rejection key, earliest-wins published the wrong verdict

- **Repo:** /Users/vitaliipopov/git/mil/tasks/MILAB-6679-developability-designer (block `antibody-variant-designer`)
- **Source:** discovery — the outcome gate traced the row's whole path and found the duplicate; no user statement produced it
- **Task:** TODO-24 "report every objective that contributed nothing" — adding an `objective` key to the rejection TSV so a parent that ships still reports the objective that found nothing
- **What I did:** left step 1 (`index_and_scan.one`) appending `('no-liability-survived-triage','',PARENT_REJECTED,'liability')` while step 3 (`build_variants`) wrote the same `(clonotype, objective)` pair as `VARIANT_REJECTED`; the model's reduce keeps the earliest step, so step 1's row won and the findings page showed `Parent` ("the run shipped nothing") for a parent whose variant was in the variants table. Step 1 also wrote that row tagged `liability` in `humanization`-only runs, where the liability objective never ran.
- **User's words:** > model/src/index.ts:127 keeps the earliest step, so step 1's row wins and the findings page shows 'Parent' while model/src/types.ts:117 … state a Parent row means the run shipped nothing — the variant is in the variants table. tests/test_index_and_scan.py:196 and tests/test_build_variants.py:923 each assert one half and never reduce them together.
- **Evidence:** `software/developability/software/src/index_and_scan.py:298`, `software/developability/software/src/build_variants.py:206-213`, `model/src/index.ts:121-128` (`if (!byPair.has(pairKey)) byPair.set(...)`); fix = `return []` for that reason in step 1, so the design step owns it
- **Ambiguous?** no — the stage that decides what ships is the only one that can state the outcome
- **Scope chosen:** global — precedence-collapsed multi-producer stores are ordinary pipeline shape, and the rule is teachable to a new colleague without any of this repo's names
- **Rule written:** verdict — the stage that can still see the final outcome owns the row; early stages return nothing for outcome claims, and one test must run the real collapse over every producer for the same key
- **Transcript:** not archived — captured from the TODO-24 gate history handed to this skill
- **Session topic:** TODO-24, report every objective that contributed nothing (wm-code-auto gate chain)
