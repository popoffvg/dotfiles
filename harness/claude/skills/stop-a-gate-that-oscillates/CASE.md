# Cases

## 2026-08-26 — A name gate renamed a parameter and then renamed it back

- **Repo:** /Users/vitaliipopov/git/mil/tasks/MILAB-6679-developability-designer/1_blocks/antibody-variant-designer
- **Source:** discovery — the fixup trail's own diffs showed the loop produced nothing
- **Task:** running TODO-20 (cut mode-2 liability targets to the CDRs) through the wm review gate chain under /code impl
- **What I did:** let the chain spend its whole 3-round budget on the wave, then reported the TODO as BLOCKED on the gate's last printed finding
- **User's words:** > [round 1, name] TODO-20.md:40 — mode — vague qualifier — → runMode … [round 3, name] run_mode — Synonym drift — → mode … [round 4, name] run_mode parameter — synonym drift — two names for one concept — → mode
- **Evidence:** fixups 7e228e1 and dad1507 in the block repo are exact inverses (`mode`→`run_mode`, then back); the opus reviewer confirmed "the two fixups cancel each other exactly — net zero". 341 tests were green throughout. The real defect underneath was a stale `## Surface` in the TODO pair, which the gate could only express as synonym drift.
- **Ambiguous?** no — a reversed verdict on one symbol is never progress
- **Scope chosen:** global — any automated review loop that runs rounds until it passes can flip on a symbol whose two ends disagree; nothing here is specific to this harness
- **Rule written:** verdict — stop the chain on a reversed finding, settle it from the repo's own usage, check the trail's net diff, and run the deeper gates the wave blocked
- **Transcript:** not archived — captured live during /code squash
- **Session topic:** MILAB-6679 humanization objective, TODO-18/19/20

## 2026-09-01 — idp → idpID → idP across three review rounds, plus a lookalike concept

- **Repo:** /Users/vitaliipopov/git/mil/tasks/MILAB-6670-multiprovider-ui/pl
- **Source:** correction — the user said "rename idpID to idP, holly" after I'd applied round 2's `idp`→`idpID` finding without cross-checking it
- **Task:** running TODO-1 (route login to the client-named method) through the wm `/code review todo` gate chain, fixing findings round by round
- **What I did:** applied round 2's name-gate finding renaming a test-helper selector parameter `idp`→`idpID` for "consistency" with `newTestSSO`'s own `idpID` parameter, without checking `CONSTRAINTS.md` R25 (which fixes the selector's Go spelling as `idP`) or noticing that `idpID` already names a *different* concept everywhere else in the codebase — an SSO provider's own configured identity, not the client-picked selector
- **User's words:** > rename idpID to idP, holly
- **Evidence:** round 3's outcome gate independently caught the same conflation and overruled its own name gate's demand to go back to `idpID`, citing R25 and the pervasive existing `idpID` usage (`newTestSSO`, `sessionmanager`, `users/store.go`) as a distinct concept; round 4 confirmed `idP` was correct and told future rounds not to re-litigate it. Fixup commits `c48338e8d` (idp→idpID) then `9eec29ecd` (idpID→idP) are exact inverses on the same three symbols.
- **Ambiguous?** no — one right answer, and it was already written down in `CONSTRAINTS.md` R25
- **Scope chosen:** global — same as the existing rule; this case sharpens step 2's "grep how the name is spelled elsewhere" into two concrete sub-checks
- **Rule written:** extends the existing verdict — before applying a gate-proposed rename, (a) check the authoritative corpus (a CONSTRAINTS-style rule file or decision note) for the concept's settled spelling, not just "how callers spell it nearby", and (b) treat an existing identically-or-similarly-spelled name used for a *different* concept elsewhere in the codebase as a signal the gate conflated two concepts, not evidence of drift
- **Transcript:** not archived — captured live during /code squash
- **Session topic:** MILAB-6670 multiprovider auth UI, TODO-1

## 2026-09-03 — "delete this test, it mirrors the implementation" reversed to "restore it" one round later

- **Repo:** /Users/vitaliipopov/git/mil/tasks/MILAB-6679-developability-designer/1_blocks/antibody-variant-designer
- **Source:** discovery — the test-worth gate returned opposite verdicts on the same two test cases in consecutive rounds
- **Task:** TODO-23 — removing the per-variant `objective` column from the variants table and the synthesis CSV, run through the `/code auto` gate chain
- **What I did:** applied round 1's test-worth finding and deleted `tests/test_variant_store.py:92` (`test_no_objective_column_reaches_the_file`) and `:102` (`test_a_variant_addressing_two_targets_holds_both_labels_joined`), which the gate called "mirrors the implementation" and "asserts the language"
- **User's words:** > (round 1) The test asserts that 'objective' is not in TSV_COLUMNS (a constant) and not in the written row; both check the same invariant through equivalent code paths — → delete … (round 2) deletion loses unique coverage of TSV file format constraint … plausible edit: someone forgets to remove objective from TSV_COLUMNS — → restore
- **Evidence:** both cases were restored in round 2 and the chain then passed; the deciding fact is that each case exercises `append_variants_tsv` / `read_variants_tsv` — the serialization boundary — not just the `TSV_COLUMNS` constant the gate saw it duplicating
- **Ambiguous?** no — the two verdicts cannot both hold, and the boundary crossing settles which one does
- **Scope chosen:** global — same rule as the existing entries; this case adds a second gate type (test worth, not naming) and a concrete way to settle a delete-vs-keep reversal
- **Rule written:** extends the existing verdict — a delete/restore reversal on a test is settled by asking whether the test crosses a boundary the mirrored code does not; a case asserting a constant *and* the bytes written from it is not a mirror
- **Transcript:** none — captured inside a `/code auto` gate loop; the gate history was supplied as JSON
- **Session topic:** TODO-23 — one variant is no longer one objective's work (antibody variant designer)
