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
2. **Name the pair.** Every gate gets the paths, never the pasted content: `<notes-dir>/todos/TODO-N.md`
   (Outcome, Components, Surface, Autotest, Deviations) and `<notes-dir>/todos/TODO-N.agent.md`
   (Changes, Files), plus `<notes-dir>/CONSTRAINTS.md` — the rules both halves obey. Leave
   `thoughts/` out of the brief — the outcome gate runs the `trace` skill itself when a rule looks
   wrong rather than merely unmet.
3. **Run the cheap wave** — @lint-tester, @comment-critic, and @name-critic in **one message**. The
   lint gate needs the pair (Files, Autotest); the comment and name gates never read it, because a
   comment is judged against the code under it and a name against its own body.
4. **Run the test gate** — @tester in TODO mode. The one question: does a test assert this TODO's
   `## Autotest` contract, both `Unit` and `E2E`? No → it writes that test and returns the files.
5. **Run the outcome gate** — @reviewer, with lint and tests already green so it does not
   re-litigate them.
6. **Merge and report** — the report shape in the roster. On every gate green, the caller advances
   the TODO `status: verify → done`; on a budget exhausted, `status: blocked`.

## What a TODO gate judges that a loose diff cannot

**The Surface is a contract, not a suggestion.** `TODO-N.md` § Surface is the exact shape every
changed symbol must end up with, approved before code existed. A signature that does not match it is
a Failure — the outcome gate checks it symbol by symbol.

**The Blast radius is the migration checklist.** Each increment in `## Changes` predicts the symbols
and callers it reaches. A caller the blast radius named and the diff did not migrate is a Failure,
never a nit.

**A `## Deviations` row supersedes the section above it.** The row is a correction the user approved
mid-implementation, so the code is right and the older section is the stale text. Judge against the
row and its `[[NNN-impl-decision-slug]]` note. A mismatch with no row is a Failure as usual, and so
is a row whose note is missing or whose reach goes past this TODO — that correction belonged in
`revise`.

**Bodies are held to a weaker standard than signatures.** Nobody specified a body; the increment
only sketched its Behavior. A body that reaches the sketch's observable outcome by other means is
fine, and one more idiomatic than the sketch is better. It is drift when it reaches a *different*
outcome, skips an error path the sketch shows, or drops an edge case the sketch names.
