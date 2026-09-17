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
| comment | every comment, doc line, and doc tag the diff adds or changes — fails the useless one, nits the rest | @comment-critic | haiku |
| name | every name the diff declares — the `pedant` smell table | @name-critic | haiku |
| test worth | every test the diff adds — and rejects the ones asserting nothing the code can get wrong | @test-critic | haiku |
| mutation | whether the tests that exist assert anything — breaks the code and reports every test that stayed green | @mutation-tester | sonnet |
| test | does a test assert the contract — and writes it when none does | @tester | sonnet |
| standards | the repo's written rules, the patterns already in use, the language idiom, correctness | @reviewer | opus |

**Three gates read the tests, and none stands in for another.** `test worth` reads the tests the
diff **wrote** and drops the ones that buy no failure mode. `mutation` reads the tests that **exist**
and asks whether they assert anything — it breaks the code under them and reports every one that
stayed green. `test` reads the contract the diff left with **no** test and writes it. One subtracts,
one measures, one adds.

### No gate judges the spec

Whether the change is the *right thing* — the Outcome delivered, the
approved Surface matched, scope kept — is settled outside this chain, by `/code verify` before the
code exists and the `verifier` agent after it. Every gate here answers the other question: is it
built right. A gate that reports drift is reporting something it was not asked to judge.

**The tier follows the kind of judgment, not the importance of the gate.** The four haiku gates
each run a written table over the diff — a linter's output, the comment rules, the smell rows, the
drop table — and a bigger model reaches the same rows more expensively. The three serious gates do
not have a table they can read off: the test gate has to design and write the missing test; the
standards gate has to rank six sources of rules against each other and then find the concrete input
that breaks the code; and the mutation gate has a table of operators but must still decide whether a
surviving mutant is a real gap or an equivalent one, and name the assertion that closes it. Those
are the judgments no checklist replaces.

## The order: one wave of judges, then the gate that writes

```
        ┌ lint                 ┐
        │ comment              │
diff ──▶┤ name                 ├──▶ test (sonnet) ──▶ PASS
        │ test worth           │
        │ standards            │
        │ mutation × <batches> │
        └──────────────────────┘
                one wave
```

**All six judging gates run as one wave, in a single message.** They read the same diff, share no
state, and each returns its own findings, so the wall clock is the slowest of the six instead of
their sum. Spawn all of them in one message — never one at a time.

**The mutation gate is a batch, not one agent.** The caller splits the diff's changed source files
into batches and spawns one `mutation-tester` per batch, in that same message
(`mutation:SKILL.md` § Run it). Every batch runs in its own git worktree — spawn with
`isolation: "worktree"` — so the working tree the other five gates are reading is never mutated. A
single-batch diff still takes a worktree inside the wave, for the same reason; in place is only for
a standalone `mutation` run.

**The standards gate runs in the wave despite its tier.** It is the expensive gate, but it reads the
same diff as the cheap four and needs nothing they produce, so putting it after them only added its
own latency to every round. A test written later still reaches it: folding that test in restarts the
whole chain at the wave (§ A gate that writes a test), so the last wave of an accepted run always
judges the final diff. The cost is one wasted opus run per restart, paid to take the opus latency
out of the round.

**The wave has a third caller, and it runs the five judges without the test gate and without
mutation.** `impl` runs it over each increment before the human approves that increment
(`impl:sub-impl.md` § The per-increment wave). The five judges read a diff and return findings, so
they work over an increment unchanged. The test gate writes files, which cannot land in an increment
still waiting for approval. The mutation gate needs a green suite and a real build, which an
increment mid-TODO does not have. Both stay per TODO.

**The test gate runs alone, after the wave is green.** It is the one gate that changes the diff
rather than judging it — it writes the missing test — so it must not run beside gates reading that
same diff.

### Any FAIL restarts the whole chain at the wave

Merge the failing gates' findings into one fixup
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
<notes-dir>/review/<target>/<gate>.md              one file per gate
<notes-dir>/review/<target>/mutation/<batch>.md   one file per mutation batch
<notes-dir>/review/<target>/report.md      the merged report, written by the caller
```

`<target>` is `TODO-N` in `todo` mode, `TODO-N/inc-<k>` when `impl` runs the wave over one increment
(`impl:sub-impl.md` § The per-increment wave), and the resolved range's slug in `diff` mode — the
branch name, the short sha, `pr-<n>`, or `worktree`. The gate slugs are the roster's Gate column with the
space as a dash: `lint`, `comment`, `name`, `test-worth`, `test`, `standards`. The mutation gate is
a batch, so it writes one file per batch under `mutation/` and the caller merges them into
`mutation.md` beside the other gate files.

**Overwrite, never append.** A fixup invalidates every earlier verdict, so the file holds the
current round only and the reader never has to work out which round they are looking at. The fixup
trail lives in git history, not in the report.

**A PASS still writes its file.** An absent file means the gate did not run — a meaning it can only
carry if a green gate always leaves one.

**Every file opens with the moment it was written**, in a `reviewed:` frontmatter block above
everything else. The files overwrite, so the timestamp is what tells a reader whether they are
looking at the round that just ran or at a file the current round never rewrote — a gate that died
leaves yesterday's verdict sitting under today's `report.md`. It belongs to the file alone: the text
a gate returns to the caller starts at its `Result:` line.

**These are notes-dir files, never source.** Writing them keeps the read-only rule this skill's
`SKILL.md` states.

## One toolchain run per round

Build, lint, and Autotest each run **once per round**, before the gate wave — the caller runs them
and writes the result to `<notes-dir>/review/<target>/toolchain.json`. No gate re-runs a command the
caller already ran; a gate that needs a verdict reads the artifact instead.

**The file the caller writes:**

```json
{
  "round": 2,
  "at": "2026-09-04T11:05:12+02:00",
  "commands": {
    "build": { "command": "go build ./...",       "exit": 0, "output": "toolchain/build.log" },
    "Unit":  { "command": "go test ./pkg/auth/...", "exit": 1, "output": "toolchain/unit.log" },
    "E2E":   { "command": "none",                  "exit": null, "output": null }
  }
}
```

`round` is the round the wave is about to run, `at` is what `date -Iseconds` printed. Each key of
`commands` is a step a gate asks about — `build`, `Unit`, `E2E` — and its entry carries the literal
command the caller ran, its exit code, and the output path, relative to
`<notes-dir>/review/<target>/`. An Autotest level written `none` gets an entry with
`"command": "none"` and a null exit, so a gate can tell a skipped level from a level nobody ran.

**Staleness is decidable from `round`.** The caller overwrites the whole file each round and puts the
same `round: <n>` line in every gate's brief, beside `report:`. A gate reads the file's `round`: it
matches the brief → the entries are this round's; it is lower, or the key it needs is absent → the
entry is stale and the gate reports `n/a`, never a run of its own.

| Gate | Toolchain |
|---|---|
| lint | runs the linter itself, over the changed files only; reads Autotest's outcome from `toolchain.json` — never runs Autotest |
| mutation | reads the test command from `toolchain.json`, narrows it to the covering tests, and runs **that** inside its own worktree — never the caller's tree, and never the whole suite |
| test | the sole executor of build and the test suite in the working tree |
| standards (`reviewer`) | never executes; may **cite** `toolchain.json` for a finding that depends on whether the diff compiles |
| test worth, name, comment | never executes, and gets no toolchain input at all — their questions do not depend on green or red |

## Every report names the rules that gate ran

A report with an empty Failures section says one of two things — the diff is clean, or the gate
never looked. So every gate report carries a `## Covered` table above its findings, one row per rule
that gate owns, and the rows are fixed: the same list every run, whatever the diff holds.

**Each gate's row set lives in its own agent file**, in the template under its Output contract —
`comment-critic` lists ten rows over its seven prose gates — six that fail and four that nit;
`name-critic` its three, `test-critic` its six drop-table rows, `mutation-tester` its ten operators,
`lint-tester` the commands it ran, `tester` its five case categories, `reviewer` its five hunts and
the sources it read. An agent is a
separate prompt that never sees this page, so the rows are written where the agent reads them.

**A gate may carry a column the others do not.** `Rule | Verdict` is the minimum; `lint-tester`
writes `Rule | Command | Verdict`, because the command it ran is the evidence for its row, and
`comment-critic` writes `Rule | Bucket | Verdict`, because each of its rows fails or nits by
construction. The extra
column is declared in that gate's agent file beside its rows.

## The merged report

Every mode reports the same thing, and it is the caller that merges — a gate reports only itself.
The caller writes the merged text to `<notes-dir>/review/<target>/report.md` and returns it.

Every finding keeps the gate that produced it. A finding whose gate is stripped cannot be
re-litigated: the reader needs to know whether a line was rejected by a table or by a judgment.

**The shape of both files is `examples/report.md`** — one gate's file and the merged report, filled,
each piece carrying its own rules. Nothing on this page is copyable; open the example to write one.
