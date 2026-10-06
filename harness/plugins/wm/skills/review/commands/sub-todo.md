# review — todo

Judge one implemented TODO against the pair the human approved. This is the gate chain
`impl:sub-auto.md` Step 2 runs per TODO, and the one `/code impl` runs as its increment review
(`fast`) and its TODO review (`normal`) — `impl:sub-impl.md` § Increment review and TODO review.

The roster — the gates, their tiers, the wave order, the FAIL routing, the budget, and the report
shape — is @../references/ref-gates.md. This file adds only what makes the gates judge a TODO.

Obeys the shared subcommand rules (`code:ref-subcommand-rules.md`); **source stays read-only** —
every finding routes back to `impl`, which is the only skill that edits.

## Steps

1. **Name the revision.** The diff under judgment is the TODO's commit plus every fixup on top of
   it — `git log --oneline` from the TODO's commit to `HEAD`. Pass that range to every gate; a gate
   that picks its own range judges a different diff from its siblings. A caller MAY name a narrower
   diff — `impl` names one increment's diff under `fast`.
2. **Plan the rules gate** — `wm-rule-batches.py plan --notes-dir <notes-dir> --todo TODO-N
   --range <range> --out <notes-dir>/review/TODO-N/rules` (`../references/ref-gates.md` § The rules
   gate). Every round, so a rule added since the last round is in this one. Exit 2 names a broken
   rule file: report it and stop.
3. **Batch the mutation gate.** Split the TODO's changed source files — bounded by
   `TODO-N.agent.md` § Files — into batches, and take each batch's narrowed test command from the
   `## Autotest` entry in `toolchain.json`, following `mutation:SKILL.md` § Run it. No changed file
   a test covers → no batch, and the gate reports `n/a`. Under `fast`, skip this step.
4. **Run the change probes.** Before round 1, write `<notes-dir>/review/TODO-N/probes.json`
   (`../references/ref-gates.md` § A gate whose input did not change passes without running). Each
   round, run every probe; a probe that prints nothing skips its gate or batch as PASS. Done when
   every gate and batch is marked run or skipped.
5. **Run the wave** — in **one message**, every gate step 4 did not skip: @lint-tester, one @rule-checker per batch line step 2
   printed (`batch: <brief path>`), @idiom-critic, @correctness-critic, and one @mutation-tester per
   batch from step 3. Every gate gets its own `report: <notes-dir>/review/TODO-N/<gate>.md` line.
   Every mutation agent gets the `checkout:` line (`mutation:SKILL.md` § 3), no `isolation`, and
   writes to `<notes-dir>/review/TODO-N/mutation/<batch-slug>.md`. The lint gate needs the pair
   (Files from `TODO-N.agent.md`, Autotest from `TODO-N.test.md`). Under `fast`, spawn no
   @mutation-tester. When the last @rule-checker returns, spawn the @rule-reducer with
   `rules: <notes-dir>/review/TODO-N/rules` and `report: <notes-dir>/review/TODO-N/rules.md`.

   From round 2, a red wave goes to the triage judge before the fixup (`ref-gates.md` § From round
   2, a red wave goes to the triage judge first) — a `general-purpose` agent on `opus`,
   `report: <notes-dir>/review/TODO-N/judge.md`.
6. **Run the test gate** — @tester in TODO mode, `report: <notes-dir>/review/TODO-N/test.md`, once
   the wave is green and the `test` probe printed a line. The one question: does a test assert this TODO's `## Autotest` contract, both
   `Unit` and `E2E`? No → it writes that test and returns the files. Under `fast`, skip this step.
7. **Merge and report** — the merged shape in `../examples/report.md`, written to
   `<notes-dir>/review/TODO-N/report.md` and returned. On every gate green, the caller advances
   the TODO `status: verify → done`; on a budget exhausted, `status: blocked`. Under `fast` the
   caller advances no `status`. Green here means *built right* only — the Outcome and the Surface
   were checked by the `verifier` agent when `status` reached `verify`.

## What the pair gives a gate that a loose diff cannot

**The pair is a rule source, not a spec to check against.** No gate judges the Outcome, the
Surface, or drift (`ref-gates.md` § No gate judges the spec).

**`--todo` turns settled decisions into rules.** Each live approved `decision` or `impl-decision`
note under `<notes-dir>/thoughts/` becomes one `D<NNN>` rule, so a breach is a Failure with a
citation. A loose diff has no thought graph.

**`TODO-N.agent.md` § Files names the expected reach, not a border.** A file outside that list is
not a finding by itself: the gates judge it like every other changed file.

**An Autotest case the human wrote is still droppable.** The test-worth rules judge the test the
diff wrote, not the case that asked for it. Dropping a listed case contradicts the approved pair,
which makes it a **deviation**: the implementer records the `impl-decision` note and the
`## Deviations` row, and never edits the Autotest table (`arch:examples/todo-test.md` § Autotest).
