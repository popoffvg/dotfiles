# review — todo

Judge one implemented TODO against the pair the human approved. This is the gate chain
`impl:sub-auto.md` Step 2 runs per TODO, and the one `/code impl` runs when the resolved `approve` key
is `none`.

The roster — the gates, their tiers, the wave order, the FAIL routing, the budget, and the report
shape — is @../references/ref-gates.md. This file adds only what makes the gates judge a TODO.

Obeys the shared subcommand rules (`code:ref-subcommand-rules.md`); **source stays read-only** —
every finding routes back to `impl`, which is the only skill that edits.

## Steps

1. **Name the revision.** The diff under judgment is the TODO's commit plus every fixup on top of
   it — `git log --oneline` from the TODO's commit to `HEAD`. Pass that revision range to every
   gate; a gate that picks its own range judges a different diff from its siblings.
2. **Name the rule files.** Every gate gets the paths, never the pasted content:
   `<notes-dir>/CONSTRAINTS.md`, `<notes-dir>/RULES.md`, and `<notes-dir>/PATTERNS.md` — the rules
   and patterns the code must obey — plus `<notes-dir>/todos/TODO-N.md` (Autotest) and
   `<notes-dir>/todos/TODO-N.agent.md` (Files) for the two gates that need them. Leave `thoughts/`
   out of the brief: no gate here judges why a rule exists.
3. **Run the wave** — @lint-tester, @comment-critic, @name-critic, @test-critic, and @reviewer in
   **one message**, each with its own `report: <notes-dir>/review/TODO-N/<gate>.md` line (§ Every
   gate writes its report to a file). The lint gate needs the pair (Files, Autotest), and
   @test-critic needs `## Autotest` so it can tell a case the human asked for from one the
   implementer invented; the comment and name gates never read the pair, because a comment is judged
   against the code under it and a name against its own body. @reviewer's brief names
   `<notes-dir>/CONSTRAINTS.md`, `<notes-dir>/RULES.md`, and `<notes-dir>/PATTERNS.md` — the rule
   sources the pair points at — and never the Outcome or the Surface. Tell it the other four gates
   run beside it, so it reports none of what they judge.
4. **Run the test gate** — @tester in TODO mode, `report: <notes-dir>/review/TODO-N/test.md`, once
   the wave is green. The one question: does a test assert this TODO's `## Autotest` contract, both
   `Unit` and `E2E`? No → it writes that test and returns the files.
5. **Merge and report** — the report shape in the roster, written to
   `<notes-dir>/review/TODO-N/report.md` and returned. On every gate green, the caller advances
   the TODO `status: verify → done`; on a budget exhausted, `status: blocked`. Green here means
   *built right* only — the Outcome and the Surface were checked by the `verifier` agent when
   `status` reached `verify`, not by this chain.

## What the pair gives a gate that a loose diff cannot

**The pair is a rule source, not a spec to check against.** No gate in this chain judges the
Outcome, the Surface, or drift — that is `/code verify` before the code and the `verifier` agent
after it (`ref-gates.md` § No gate judges the spec). What the pair adds here is three files the
standards gate can cite by name.

**`CONSTRAINTS.md` turns taste into a rule.** Each `R<n>` row is a decision the human settled, so a
breach is a Failure with a citation instead of a reviewer's opinion. A loose diff has no such file
and the same finding lands as a Nit.

**`PATTERNS.md` names the pattern the code was meant to follow.** Without it the standards gate
infers the pattern from the neighbouring files, which is weaker: a package that is itself
inconsistent gives it nothing to cite.

**`TODO-N.agent.md` § Files bounds the diff.** The gate knows which files the change was supposed to
touch, so a file changed outside that list is worth a line — as a rule question for the human, never
as drift the gate rules on.

**An Autotest case the human wrote is still droppable.** @test-critic judges the test the diff
wrote, not the case that asked for it, so a listed `## Autotest` case whose code has no condition
comes back as a Failure. Dropping it contradicts the approved pair, which makes it a **deviation**:
the implementer records the `impl-decision` note and the `## Deviations` row, and never edits the
Autotest table (`arch:ref-todo-sections.md`).
