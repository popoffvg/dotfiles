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
| test | does a test assert the contract — and writes it when none does | @tester | sonnet |
| outcome | the Outcome delivered, correctness, spec drift | @reviewer | opus |

**The tier follows the kind of judgment, not the importance of the gate.** The three haiku gates
each run a written table over the diff — a linter's output, the comment rules, the smell rows — and
a bigger model reaches the same rows more expensively. The two serious gates do not have a table:
the test gate has to design and write the missing test, and the outcome gate has to re-derive the
Outcome from the spec and the real code, which is the one judgment no checklist replaces.

## The order: one cheap wave, then two serious gates

```
        ┌ lint ┐
diff ──▶├ comment ├──▶ test (sonnet) ──▶ outcome (opus) ──▶ PASS
        └ name ┘
         one wave, haiku
```

**The three haiku gates run as one wave, in a single message.** They read the same diff, share no
state, and each returns its own findings, so the wall clock is the slowest of the three instead of
their sum. Spawn all three in one message — never one at a time.

**The two serious gates run in series, after the wave is green.** The test gate before the outcome
gate: a test it writes changes the diff the outcome gate must judge, so running them the other way
around makes the opus read stale.

**Any FAIL restarts the whole chain at the wave.** Merge the failing gates' findings into one fixup
brief, hand it to `impl` (`impl:sub-commit.md` § Fixups — a correction is a fixup, never a plain
commit), then run the wave again from the start. A fixup can break what a later gate already
cleared, so no gate result survives a fixup.

**A gate that writes a test is not a FAIL.** The test gate returns the files it wrote and left
uncommitted; the implementer folds them into the TODO's commit and the chain restarts at the wave —
a new test file can break lint.

## The gate budget

`auto` passes a budget (three rounds per gate by default). A gate that fails that many rounds ends
the round: the TODO goes `status: blocked` with the last findings recorded, and the caller moves to
the next TODO no blocked TODO blocks. The budget is per gate, not per chain — three lint failures
and three outcome failures are two separate ceilings.

Standalone `/code review` has no budget: it reports the findings once and stops. It never loops,
because a human is reading the report.

## The merged report

Every mode reports the same thing, and it is the caller that merges — a gate reports only itself:

```
[GATE] Result: PASS | FAIL   (after <n> round(s))

## Gates
- lint <PASS|FAIL> · comment <PASS|FAIL> · name <PASS|FAIL> · test <PASS|FAIL> · outcome <PASS|FAIL>

## Failures        (omit when PASS)
- <gate> · <file:line> — <the scenario or the rule> — <the edit that closes it>

## Nits           (optional, non-blocking)
- <gate> · <file:line> — <observation>
```

Every finding keeps the gate that produced it. A finding whose gate is stripped cannot be
re-litigated: the reader needs to know whether a line was rejected by a table or by a judgment.
