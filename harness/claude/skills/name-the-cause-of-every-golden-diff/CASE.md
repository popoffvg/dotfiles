# Cases

## 2026-09-02 — Regenerated golden TSV hid an output column changing meaning on all 18 rows

- **Repo:** /Users/vitaliipopov/git/mil/tasks/MILAB-6679-developability-designer/1_blocks/antibody-variant-designer
- **Source:** discovery — the outcome gate's comparison against the pre-change ref, not a user statement
- **Task:** TODO-21 of the antibody-variant-designer spec — generalizing the variant builder to a run-mode over several design objectives, under a constraint that a `liabilities`-mode run's every output file stays byte-identical to the pre-change tree.
- **What I did:** Passed `args.run_mode` where the per-objective name belonged (`src/build_variants.py:363`), then regenerated `tests/golden/variants.tsv` and took `uv run pytest -q` → 376 passed as confirmation. The regen silently rewrote the `objective` column from `liability` to `liabilities` on all 18 rows — the exact byte-identity the constraint forbade breaking.
- **User's words:** > moving the `liabilities`-mode `objective` column from `liability` to `liabilities` across all 18 rows of `tests/golden/variants.tsv`; `git show 5649186:.../golden/variants.tsv` confirms the pre-change value was `liability` … that is exactly the unexplained golden movement § Manual test step 4 calls a finding
- **Evidence:** `git show 5649186:.../tests/golden/variants.tsv | head -2` → `objective` column value `liability`; the regenerated capture at HEAD writes `liabilities`. Test suite green before and after: `uv run pytest -q` → 376 passed.
- **Ambiguous?** no — one right answer; an output movement no task line requests is a contract break, and the capture must go back rather than certify it.
- **Scope chosen:** global — worth teaching a new colleague; snapshot/approval/golden regeneration is the standard workflow in every language, and the failure mode (regen makes the test green whether or not the movement was wanted) does not depend on this repo.
- **Rule written:** verdict — before accepting a regenerated capture, diff it against the pre-change ref field by field and match every movement to a line in the task; fix the source and regenerate back when a movement has no named cause.
- **Transcript:** none — captured inside a `/code auto` gate loop; the gate history was supplied as JSON.
- **Session topic:** TODO-21 — run-mode over several design objectives in the antibody variant builder.

## 2026-09-03 — the golden had no combined-mode row, so the Outcome's combined-mode claim was unverified

- **Repo:** /Users/vitaliipopov/git/mil/tasks/MILAB-6679-developability-designer/1_blocks/antibody-variant-designer
- **Source:** discovery — an outcome-gate check showed the capture could not falsify the claim it was cited for
- **Task:** TODO-23 — widening `addressedTarget` to name every target a variant addresses, whose stated Outcome was "a combined-mode row shows both a cleared liability and a humanised position"
- **What I did:** treated `golden/variants-liabilities-and-humanization.tsv` as covering the combined case because its name says liabilities *and* humanization
- **User's words:** > `cut -f6 golden/variants-liabilities-and-humanization.tsv | sort -u` → a single one-label value, no combined-mode row with two targets
- **Evidence:** every row's `addressedTarget` held one label; the only coverage of the two-label case was a synthetic unit test in `tests/test_variant_store.py`, and the E2E file was still the 5-line scaffold (same blocker LESSONS.md records for TODO-22)
- **Ambiguous?** no — a capture with no such row cannot be evidence for the claim; either add an input that produces one or state the gap
- **Scope chosen:** global — same rule as the existing entries; this case adds the coverage direction (what the capture cannot show) to the existing movement direction (what moved and why)
- **Rule written:** extends the existing verdict — before citing a golden as evidence for a combined/multi-value claim, check with a column extract that a row exercises it; when none does, add such an input or record the claim as unverified
- **Transcript:** none — captured inside a `/code auto` gate loop; the gate history was supplied as JSON
- **Session topic:** TODO-23 — one variant is no longer one objective's work (antibody variant designer)
