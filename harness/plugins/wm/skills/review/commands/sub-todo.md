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
   it — `git log --oneline` from the TODO's commit to `HEAD`. Pass that revision range to every
   gate; a gate that picks its own range judges a different diff from its siblings. A caller MAY
   name a narrower diff — `impl` names one increment's diff under `fast`.
2. **Name the rule sources.** Every gate gets paths, never the pasted content:
   `<notes-dir>/review/TODO-N/constraints.md`, the rules the code must obey — write it when it is
   absent or stale (`../references/ref-gates.md` § One rule file per TODO) — plus
   `<notes-dir>/RULES.md` and `<notes-dir>/PATTERNS.md` for the patterns it must follow,
   plus `<notes-dir>/todos/TODO-N.test.md` (Autotest) and `<notes-dir>/todos/TODO-N.agent.md` (Files) for
   the two gates that need them. The generator is the only reader of `thoughts/` here: no gate
   judges why a rule exists.
3. **Batch the mutation gate.** Split the TODO's changed source files — bounded by
   `TODO-N.agent.md` § Files — into batches, and take each batch's narrowed test command from the
   `## Autotest` entry in `toolchain.json`, following `mutation:SKILL.md` § Run it. A TODO whose
   changed files no test covers produces no batch and the gate reports `n/a`; the missing test is the
   test gate's finding in step 5. Under `fast`, skip this step.
4. **Run the wave** — @lint-tester, @comment-critic, @name-critic, @test-critic, @idiom-critic,
   @reviewer, and one @mutation-tester per batch from step 3, in **one message**, each with its own
   `report: <notes-dir>/review/TODO-N/<gate>.md` line (§ Every gate writes its report to a file).
   Every mutation agent gets the `checkout:` line (`mutation:SKILL.md` § 3), no `isolation`, and writes to
   `<notes-dir>/review/TODO-N/mutation/<batch-slug>.md`. The lint gate needs the pair (Files,
   Autotest), and @test-critic needs `## Autotest` so it can tell a case the human asked for from one
   the implementer invented; under `fast`, spawn no @mutation-tester. The comment, name, idiom, and mutation gates never read the pair, because a
   comment is judged against the code under it, a name against its own body, a line against its
   language, and a mutant against the test that fails to catch it. @reviewer's brief carries the
   `constraints: <notes-dir>/review/TODO-N/constraints.md` line and names `<notes-dir>/RULES.md` and
   `<notes-dir>/PATTERNS.md` — the rule sources the pair points at — and
   never the Outcome or the Surface. Tell it the other gates run beside it, so it reports none of
   what they judge.

   From round 2, a red wave goes to the triage judge before the fixup (§ From round 2, a red wave goes
   to the triage judge first) — a `general-purpose` agent on `opus`, `report: <notes-dir>/review/TODO-N/judge.md`.
5. **Run the test gate** — @tester in TODO mode, `report: <notes-dir>/review/TODO-N/test.md`, once
   the wave is green. The one question: does a test assert this TODO's `## Autotest` contract, both
   `Unit` and `E2E`? No → it writes that test and returns the files. Under `fast`, skip this step.
6. **Merge and report** — first run `bin/gate-bucket-check.py` on `comment.md` and `name.md`
   (`ref-gates.md` § The caller runs the bucket check). Then the merged shape in `../examples/report.md`, written to
   `<notes-dir>/review/TODO-N/report.md` and returned. On every gate green, the caller advances
   the TODO `status: verify → done`; on a budget exhausted, `status: blocked`. Under `fast` the caller
   advances no `status`. Green here means
   *built right* only — the Outcome and the Surface were checked by the `verifier` agent when
   `status` reached `verify`, not by this chain.

## What the pair gives a gate that a loose diff cannot

**The pair is a rule source, not a spec to check against.** No gate in this chain judges the
Outcome, the Surface, or drift — that is `/code verify` before the code and the `verifier` agent
after it (`ref-gates.md` § No gate judges the spec). What the pair adds here is three rule sources the
standards gate can cite by name.

**The generated rule set turns taste into a rule.** Each `D<NNN>` row is a decision the human
settled, so a breach is a Failure with a citation instead of a reviewer's opinion. A loose diff has
no thought graph to generate from and the same finding lands as a Nit.

**`PATTERNS.md` names the pattern the code was meant to follow.** Without it the standards gate
infers the pattern from the neighbouring files, which is weaker: a package that is itself
inconsistent gives it nothing to cite.

**`TODO-N.agent.md` § Files names the expected reach, not a border.** The implementer MAY change a
file outside that list when the work needs it. Such a file is not a finding by itself: the gate
judges it like every other changed file.

**An Autotest case the human wrote is still droppable.** @test-critic judges the test the diff
wrote, not the case that asked for it, so a listed `## Autotest` case whose code has no condition
comes back as a Failure. Dropping it contradicts the approved pair, which makes it a **deviation**:
the implementer records the `impl-decision` note and the `## Deviations` row, and never edits the
Autotest table (`arch:examples/todo-test.md` § Autotest).
