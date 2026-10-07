# The gate roster

The gates both `review` modes run: which one judges what, which agent runs it, at which model tier,
and how a FAIL routes back. One home — no mode restates a row.

A **gate** is one read-only step that returns `PASS | FAIL` with findings over one diff. Each agent
carries its own verdict contract in its own file, because an agent is a separate prompt that never
sees this skill.

## The roster

| Gate | Judges | Agent | Model |
|---|---|---|---|
| lint | the repo's linter over the changed files, and the tests that cover them | @lint-tester | haiku |
| rules | every rule in the rule files, against each changed file in the rule's scope — comments, names, test worth, tables, language rules, the TODO's decisions | @rule-checker per batch, then one @rule-reducer | haiku; reducer sonnet |
| idiom | every changed line — is it written the way its language and pinned version expect | @idiom-critic | sonnet |
| reuse | every new symbol and changed body — does it write again a job the repo or its dependencies already do; `PATTERNS.md` § Need → use is its contract | @reuse-critic | sonnet |
| correctness | the inputs that make the changed code give a wrong result | @correctness-critic, with one @hypothesis-checker per hypothesis | opus; checkers sonnet |
| mutation | **only when the operator passes `mutation`** — which unit and table tests the diff added can be deleted — a mutant they alone kill keeps them; E2E tests are the reference, never judged | @mutation-tester | sonnet |
| test | does a test assert the contract — and writes it when none does | @tester | sonnet |

**The tier follows the kind of judgment.** A rule is one narrow yes/no question with an example, so
haiku checks it, and a sonnet reducer drops the false hits. Idiom needs language knowledge,
reuse needs a search of the repo for the job, correctness needs a guess about inputs, mutation needs to plan mutants that separate one
test from another, and the test gate writes code. No rule file replaces those five.

### No gate judges the spec

Whether the change is the *right thing* — the Outcome delivered, the approved Surface matched, scope
kept — is settled by `/code verify` before the code exists and the `verifier` agent after it. Every
gate here answers: is it built right.

## The rules gate: map, then reduce

A **rule file** is markdown in `<notes-dir>/rules/` (project) or `~/.notes/rules/` (global). Each
`# H1` is one rule; the text under it is the rule's description. The `paths:` frontmatter sets the
files it applies to; with no `paths:`, the file name does (`go.md` → `*.go`). A rule body may carry
`Severity: nit`.

```
wm-rule-batches.py plan ──▶ batches/b001.md … bNNN.md   (≤ 8 batches: rules that cover the same files × those files' hunks)
        │
        ├─▶ rule-checker (haiku) b001 ─┐
        ├─▶ rule-checker (haiku) b002 ─┼─▶ rule-reducer (sonnet) ─▶ rules.md
        └─▶ rule-checker (haiku) bNNN ─┘     runs `check` first
```

**Plan every round.** The caller runs, before each wave:

```sh
~/.claude/scripts/wm-rule-batches.py plan --notes-dir <notes-dir> [--todo TODO-N] \
  --range <range> --out <notes-dir>/review/<target>/rules
```

The plan reads the rule dirs again each round, so a rule added mid-chain is checked in the next
round. Only `--todo` adds the TODO's settled decisions as `D<NNN>` rules; `diff` mode loads none.
The project's `RULES.md` and `PATTERNS.md` are rule files in both modes. The plan prints one line,
`<n> rule(s), <n> file(s), <N> batch(es) → <manifest>`: spawn one @rule-checker per brief
`batches/b001.md` … `bNNN.md`, with `batch: <the brief path>`.

**The agent count is capped, not the rule count.** The plan pools the rules that cover the same
changed files and cuts each pool into batches of 10 rules. When that gives more than 8 batches, each
batch takes more rules instead (`--batch-size`, `--max-batches`). A checker judges from the hunks
and opens a file only for a function a rule needs, so no file is read once per batch.

**No rule is missed in silence.** `wm-rule-batches.py check` — the reducer's first step — fails the
gate when a planned (file, rule) pair has no verdict row, or when a rule file gained a rule after
the plan. A rule file with no scope, or with text above its first H1, stops the plan with exit 2.

**The reducer filters, never adds.** It re-reads each FAIL at the tip, drops a false hit with a
reason, merges duplicates, and sets the bucket: `Severity: nit` → Nit, every other rule → Failure.

## The order: one wave of judges, then the gate that writes

```
        ┌ lint                         ┐
        │ rules: checker × <batches>   │──▶ rule-reducer
diff ──▶┤ idiom                        ├──────────────────▶ test (sonnet) ──▶ PASS
        │ reuse                        │
        │ correctness                  │
        │ mutation × ≤2 (on request)   │
        └──────────────────────────────┘
                  one wave
```

**All judging agents start in one message**: lint, every rule-checker, idiom, reuse, correctness, and — only
when the operator passed `mutation` (`../SKILL.md` § Mutation) — every mutation batch. They read the same diff and share no state. Spawn the @rule-reducer as soon as the
last rule-checker returns; it does not wait for the other gates.

**The mutation gate runs at most two agents.** The caller deals the packages that hold candidate
tests into one or two batches and spawns one @mutation-tester per batch (`mutation:SKILL.md` § Run it). Every mutant lands in a
sandbox copy of the checkout, so the tree the other gates read never changes.

**A `fast` run** (`../SKILL.md` § Speed) is the wave without the test gate, and never with mutation.
`impl` runs it over each increment under `approve: increment`. The test gate writes files, which
cannot land in an increment still waiting for approval; mutation needs a green suite.

**The test gate runs alone, after the wave is green.** It changes the diff — it writes the missing
test — so it must not run beside gates reading that diff.

### Any FAIL restarts the whole chain at the wave

Merge the failing gates' findings into one fixup brief, hand it to `impl` (`impl:sub-commit.md` §
Fixups), then run the wave again from the plan step. A fixup can break what a gate already cleared,
so every gate runs again unless its change probe shows the fixup did not reach its input.

**A gate that writes a test is not a FAIL.** The test gate returns the files it wrote, uncommitted,
and the implementer folds them into the TODO's commit. The next round runs the rules gate alone,
over the new test files. Green → the chain is green. Red → the fixup runs and the chain restarts.

### A gate whose input did not change passes without running

Before the first wave, the caller writes one **change probe** per gate into
`<notes-dir>/review/<target>/probes.json`. A change probe is a shell command that prints the lines
of the gate's input that changed between the trees `$SINCE` and `$NOW`. **It prints nothing → the
gate is skipped, and a skipped gate is PASS.** The caller runs every probe before every wave, round 1 included.

| Gate | Probe key | Input the probe watches |
|---|---|---|
| lint | `lint` | changed source and test lines that are not comments; the linter config |
| rules | `rules/<rule file stem>` | in the batch file: the lines that rule file judges — comment lines for `comments.md`, test files for `test.md`, every line for the rest |
| idiom | `idiom` | changed source lines that are not comments |
| reuse | `reuse` | changed source lines that are not comments; `PATTERNS.md` |
| correctness | `correctness` | changed source lines that are not comments |
| mutation | `mutation` | the candidate test files, and the source lines they call that are not comments |
| test | `test` | changed source lines that are not comments, and the test files |

The table fixes what each probe watches; the caller writes the command for the repo's languages and
comment syntax. `$FILES` is the batch file for a rules probe and the candidate test files for a
mutation probe:

```json
{
  "probes": {
    "lint": "git diff -U0 \"$SINCE\" \"$NOW\" -- '*.go' .golangci.yml | grep -E '^[+-][^+-]' | grep -vE '^[+-]\\s*//'",
    "rules/comments": "git diff -U0 \"$SINCE\" \"$NOW\" -- $FILES | grep -E '^[+-]\\s*//'",
    "mutation": "git diff --name-only \"$SINCE\" \"$NOW\" -- $FILES"
  },
  "passed": { "lint": "4b825dc6…", "rules/comments": "4b825dc6…" }
}
```

**`$SINCE` is the tree the gate last passed on**, read from `passed`. With no entry — round 1, or
a gate that never passed — it is the base of the range. So round 1 skips a gate the diff gives
nothing to judge (no comment line changed → no comment rules), and a later round skips a gate the
fixup did not reach. `$NOW` is the round's tree, written before the probes run; it covers an
uncommitted diff and untracked files, which `git diff <tree>` against the working tree misses:

```sh
t=$(mktemp -u); GIT_INDEX_FILE=$t git add -A; GIT_INDEX_FILE=$t git write-tree; rm -f "$t"
```

After each wave, the caller sets `passed[<key>]` to `$NOW` for every gate that ran and passed, and
leaves a skipped gate's entry as it is.

**A gate that failed last round always runs.** Its probe is not read: a fixup that missed its input
leaves the failure in place.

**A skipped gate still writes its report**: `Result: PASS` and one line
`skipped: probe <key> printed nothing since <SINCE>`. A skipped rule batch gets a result file with
one PASS row per (file, rule) pair, so `wm-rule-batches.py check` finds every pair. A batch is
skipped only when the probe of every rule file in it prints nothing for the batch file.

### From round 2, the reducer's brief carries what earlier rounds settled

Add one `settled: <old> → <new>` line per rename a fixup already applied. The reducer drops a FAIL
that asks to rename a settled name again, unless it names a rule no earlier round raised.

### From round 2, a red wave goes to the triage judge first

A late round fails mostly on taste, and each taste finding costs a fixup round that moves no
behaviour. The **triage judge** — one opus agent — reads the diff and marks each finding
**blocking** or **nit**.

| Kind | Findings |
|---|---|
| blocking | a correctness bug, a lint or test failure, a broken rule that is not `Severity: nit`, a `D<NNN>` rule broken, an UNCHECKED rule |
| nit | a style preference, a clearer name for a name that is not wrong, wording, ordering — any fix that changes no behaviour and hides no bug |

A finding the judge is not sure of is blocking. **All nits → `ALLOW`:** the wave counts as green;
record the waived nits in the report. **Any blocking → `BLOCK`:** the fixup runs. The judge writes
`judge.md` beside the gate reports and judges only the wave.

## The gate budget

`auto` passes a budget (three rounds per gate by default). A gate that fails that many rounds ends
the round: the TODO goes `status: blocked` with the last findings recorded. The budget is per gate,
not per chain.

Standalone `/review` has no budget: it reports once and stops, because a human reads the report.

## Every gate writes its report to a file

**The caller names the path; the agent writes it.** Each brief carries a `report:` line (a
rule-checker's batch file carries `result:`). The agent writes there — the same text it returns —
before it returns.

```
<notes-dir>/review/<target>/<gate>.md              lint, rules, idiom, reuse, correctness, test, judge
<notes-dir>/review/<target>/rules/                 manifest.json, batches/, results/
<notes-dir>/review/<target>/probes.json            the change probes and the tree each gate last passed on
<notes-dir>/review/<target>/mutation/<batch>.md    one file per mutation batch
<notes-dir>/review/<target>/report.md              the merged report, written by the caller
```

`<target>` is `TODO-N` in `todo` mode, `TODO-N/inc-<k>` for one increment
(`impl:rulesets/approve-*.md`), and the resolved range's slug in `diff`
mode — the branch name, the short sha, `pr-<n>`, or `worktree`. The caller merges the mutation
batches into `mutation.md`.

**Overwrite, never append.** A fixup invalidates every earlier verdict; the plan step clears
`batches/` and `results/`. The fixup trail lives in git history.

**A PASS still writes its file.** An absent file means the gate did not run.

**Every file opens with a `reviewed:` frontmatter block** holding `date -Iseconds`. The files
overwrite, so the timestamp tells whether the file is from the round that just ran. The returned
text starts at its `Result:` line.

**These are notes-dir files, never source.**

## One toolchain run per round

Build, lint, and Autotest each run **once per round**, before the wave — the caller runs them and
writes `<notes-dir>/review/<target>/toolchain.json`. No gate re-runs a command the caller ran.

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

`round` is the round about to run. Each `commands` key carries the literal command, its exit code,
and the output path relative to `<notes-dir>/review/<target>/`. An Autotest level written `none`
gets `"command": "none"` and a null exit. A gate whose brief `round:` differs from the file's, or
whose key is absent, reports `n/a`, never a run of its own.

| Gate | Toolchain |
|---|---|
| lint | runs the linter over the changed files; reads Autotest's outcome from `toolchain.json` |
| mutation | runs the unit command per mutant, in sandbox copies; runs the `E2E` command from `toolchain.json` only for a mutant a candidate kills, one at a time |
| test | the sole executor of build and the test suite in the working tree |
| correctness (and its checkers) | never executes; may cite `toolchain.json` |
| rules, idiom, reuse | never execute, and get no toolchain input |

## Every report names the rules that gate ran

Every gate report carries a `## Covered` table: one row per rule the gate owns, the same rows every
run. An empty Failures section under a full table says the diff is clean; under a short one it says
nothing. The rules gate's rows are the rules in `manifest.json` plus `Coverage`; every other gate's
rows live in its agent file.

## The merged report

The caller merges and writes `<notes-dir>/review/<target>/report.md`. Every finding keeps the gate
that produced it. The shape of both files is `examples/report.md`.
