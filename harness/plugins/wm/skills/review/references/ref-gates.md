# The gate roster

The gates both `review` modes run: which one judges what, which agent runs it, at which model tier,
and how a FAIL routes back. One home — no mode restates a row.

A **gate** is one read-only agent that returns `PASS | FAIL` with findings over one diff. Each gate
carries its own verdict contract in its own agent file, because an agent is a separate prompt that
never sees this skill.

## The roster

| Gate | Judges | Agent | Model |
|---|---|---|---|
| lint | the repo's linter over the changed files, and the tests that cover them | @lint-tester | haiku |
| comment | every comment, doc line, and doc tag the diff adds or changes | @comment-critic | haiku |
| name | every name the diff declares — the `pedant` smell table | @name-critic | haiku |
| test worth | every test the diff adds — and rejects the ones asserting nothing the code can get wrong | @test-critic | haiku |
| test | does a test assert the contract — and writes it when none does | @tester | sonnet |
| standards | the repo's written rules, the patterns already in use, the language idiom, correctness | @reviewer | opus |

The two test gates are opposites and both are needed. `test worth` reads the tests the diff
**wrote** and drops the ones that buy no failure mode; `test` reads the contract the diff left with
**no** test and writes it. One subtracts, one adds, so neither can stand in for the other.

**No gate judges the spec.** Whether the change is the *right thing* — the Outcome delivered, the
approved Surface matched, scope kept — is settled outside this chain, by `/code verify` before the
code exists and the `verifier` agent after it. Every gate here answers the other question: is it
built right. A gate that reports drift is reporting something it was not asked to judge.

**The tier follows the kind of judgment, not the importance of the gate.** The four haiku gates
each run a written table over the diff — a linter's output, the comment rules, the smell rows, the
drop table — and a bigger model reaches the same rows more expensively. The two serious gates do
not have a table: the test gate has to design and write the missing test, and the standards gate
has to rank six sources of rules against each other and then find the concrete input that breaks
the code, which is the one judgment no checklist replaces.

## The order: one wave of judges, then the gate that writes

```
        ┌ lint       ┐
        │ comment    │
diff ──▶┤ name       ├──▶ test (sonnet) ──▶ PASS
        │ test worth │
        └ standards  ┘
          one wave
```

**All five judging gates run as one wave, in a single message.** They read the same diff, share no
state, and each returns its own findings, so the wall clock is the slowest of the five instead of
their sum. Spawn all five in one message — never one at a time.

**The standards gate runs in the wave despite its tier.** It is the expensive gate, but it reads the
same diff as the cheap four and needs nothing they produce, so putting it after them only added its
own latency to every round. A test written later still reaches it: folding that test in restarts the
whole chain at the wave (§ A gate that writes a test), so the last wave of an accepted run always
judges the final diff. The cost is one wasted opus run per restart, paid to take the opus latency
out of the round.

**The test gate runs alone, after the wave is green.** It is the one gate that changes the diff
rather than judging it — it writes the missing test — so it must not run beside gates reading that
same diff.

**Any FAIL restarts the whole chain at the wave.** Merge the failing gates' findings into one fixup
brief, hand it to `impl` (`impl:sub-commit.md` § Fixups — a correction is a fixup, never a plain
commit), then run the wave again from the start. A fixup can break what a later gate already
cleared, so no gate result survives a fixup.

**A gate that writes a test is not a FAIL.** The test gate returns the files it wrote and left
uncommitted; the implementer folds them into the TODO's commit and the chain restarts at the wave —
a new test file can break lint, and `test worth` judges it on that second pass.

## The gate budget

`auto` passes a budget (three rounds per gate by default). A gate that fails that many rounds ends
the round: the TODO goes `status: blocked` with the last findings recorded, and the caller moves to
the next TODO no blocked TODO blocks. The budget is per gate, not per chain — three lint failures
and three standards failures are two separate ceilings.

Standalone `/code review` has no budget: it reports the findings once and stops. It never loops,
because a human is reading the report.

## Every gate writes its report to a file

**The caller names the path; the gate writes it.** Each gate's brief carries a `report:` line, and
the gate writes its report there — the same text it returns — before it returns. A gate never picks
its own path, so two gates can never collide and the caller always knows where to look.

```
<notes-dir>/review/<target>/<gate>.md      one file per gate
<notes-dir>/review/<target>/report.md      the merged report, written by the caller
```

`<target>` is `TODO-N` in `todo` mode and the resolved range's slug in `diff` mode — the branch
name, the short sha, `pr-<n>`, or `worktree`. The gate slugs are the roster's Gate column with the
space as a dash: `lint`, `comment`, `name`, `test-worth`, `test`, `standards`.

**Overwrite, never append.** A fixup invalidates every earlier verdict, so the file holds the
current round only and the reader never has to work out which round they are looking at. The fixup
trail lives in git history, not in the report.

**A PASS still writes its file.** An absent file means the gate did not run — a meaning it can only
carry if a green gate always leaves one.

**These are notes-dir files, never source.** Writing them keeps the read-only rule this skill's
`SKILL.md` states.

## The merged report

Every mode reports the same thing, and it is the caller that merges — a gate reports only itself.
The caller writes the merged text to `<notes-dir>/review/<target>/report.md` and returns it:

```
[GATE] Result: PASS | FAIL   (after <n> round(s))

## Gates
- lint <PASS|FAIL> · comment <PASS|FAIL> · name <PASS|FAIL> · test worth <PASS|FAIL> · test <PASS|FAIL> · standards <PASS|FAIL>

## Failures        (omit when PASS)
- <gate> · <file:line> — <the scenario or the rule> — <the edit that closes it>

## Nits           (optional, non-blocking)
- <gate> · <file:line> — <observation>
```

Every finding keeps the gate that produced it. A finding whose gate is stripped cannot be
re-litigated: the reader needs to know whether a line was rejected by a table or by a judgment.
