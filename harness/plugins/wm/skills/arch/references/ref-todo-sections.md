# arch — what cuts across the TODO pair

**The rules for each section live in the filled artifacts**, one `>` block under the piece it governs:
[`examples/todo.md`](../examples/todo.md) (human half) and
[`examples/todo-agent.md`](../examples/todo-agent.md) (agent half). Open the half you are writing and
read the block under each heading — there is no second copy of a section rule anywhere.

This file holds only what no single section owns: the prose rule both halves obey, where the
generated rules come from, the two doctrines that bound every diff in the pair, and what an approval
buys. `sub-todo.md` owns the procedure — the fan-out, the budgets, the verification chain, the
pre-save checklist. Which half each heading lives in: `sub-todo.md` § Required elements.

| Section | Half | Its rules |
|---|---|---|
| frontmatter (`status`, `type`, `depends_on`, `risk`, `approve`, `increment`) | `TODO-N.md` | `examples/todo.md` |
| Outcome, New terms, Components, Surface, Autotest, Commit, Deviations | `TODO-N.md` | `examples/todo.md` |
| Constraints, Changes, Files, Pre-reads, Manual test, Definition of done | `TODO-N.agent.md` | `examples/todo-agent.md` |

## Every prose line

**Every prose line of `TODO-N.md` obeys the `i-have-adhd` skill.** The human half is read once, by a
person deciding whether to approve it — Outcome, Delivers, New terms **Meaning**, Components **Role**, Autotest
cases, `Commit.Body`, and any sentence beside a table. Load that skill and write under its rules: one
idea per sentence, short sentences, front-loaded, literal words, no restatement. The agent half is
read by an implementer and is not bound by it.

## Constraints — where the rules come from

The rules every increment obeys are **generated** from `<notes-dir>/thoughts/`, never written by
hand. The agent half carries the command that prints them and never a rule
(`examples/todo-agent.md` § Constraints). Run
`~/.claude/scripts/wm-constraints.py <notes-dir>/thoughts` to see the set a TODO is bounded by; no
file in the corpus holds it.

**One row per note that is live, `status: approved`, and of type `decision` or `impl-decision`.** A
note under `thoughts/archived/` generates nothing, and neither does a `fact` — which is what makes
`fact` the right type for a rule no increment can violate. Each row carries the note's `id` as
`D<NNN>` and its `description` verbatim, so the rule a reader obeys and the rule an author wrote are
the same text. An `impl-decision` row is scoped by its `todo:` key
(`ref-note-format.md` § Frontmatter).

**In `thoughts/` — the decision note, which *is* the rule.** There is no rules file to append to.
A settled decision an increment can violate is a `decision` (or `impl-decision`) note, and its
frontmatter `description` is the rule text the implementer reads:

- **Write the description as the rule.** One or two sentences stating what the code must do. The
  same text serves the thought index and the constraint set, so there is no second place to keep in
  step — and no row anyone can forget to append.
- `#` is `D<NNN>`, the note's own id. Never reused, so never renumbered: a reader is never
  repointed at a different rule.
- **One note per decision** — the rule set cannot hold a duplicate, because two TODOs obeying one
  decision still read one note.
- A decision that changes is an **edit to that note's description**. A decision that is reversed is
  `status: declined` + `superseded_by:`, and the archive hook removes it from the rule set.
- A decision no increment anywhere can violate is not a constraint. Write it as a `fact` note — the
  generator skips those, and the `trace` skill still finds it.

## A diff carries the change, not what the change forces

**One entry per file whose contract this TODO decides.** A file that only *moves* to a contract
decided elsewhere in the same section carries no entry: a caller that passes the new argument, an
import updated after a symbol moves, a middle layer that only forwards a new field, a name replaced
at every use. Its diff is already fixed by the entry it follows, so writing it puts one decision in
two places — the same reason a body never appears here.

**The test: does the reader make a choice in this file?** Read the entry this one depends on, then ask
what this file can look like. One answer → it is a consequence; skip it. More than one answer → it is
a real decision; keep it. A caller that must *build* the new argument — pick a default, convert a
value, read a config key — decides what to pass, and that value is what the human approves. Keep the
deciding line alone, never the propagation around it.

**A skipped consequence still has a home, and it is the agent half.** The file stays in `## Files`;
the increment that changes the deciding symbol says to migrate the call sites in its **Do**, and its
**Blast radius** names them. `examples/todo-agent.md` § Changes already demands that instruction,
which is why Surface can drop the diff and lose nothing. A consequence-only file gets no
`## Components` row either — it holds no symbol this TODO decides.

## A diff carries the surface, not a body

A **body** is anything whose content *is* the implementation: a function or method body, a loop, a
branch chain, a shell script, a SQL query, a regex, a fixture, a table of literal expected values, a
test file's assertions. None of it goes in a `## Surface` diff, and the reason is not length — it is
that a body written here is written twice. The implementer either copies it, in which case the review
happened against a paste; or improves it, in which case the TODO is wrong from the first commit.

**The default is absolute: never put a function body in the diff.** Not to show intent, not because
the body is short, not because it "clarifies" the signature. Show the signature; put the logic in the
increment's **Behavior** sketch, where it is pseudocode nobody can copy.

**The one exception is a human asking for it directly.** When the human explicitly says they want a
body written out for a specific symbol, write it — and mark it, so the next reader can tell an
approved body from a smuggled one:

```
- **Body requested:** `Refresh` — the human asked for the full body on 2026-08-21.
```

That marker sits under the file's diff in `## Surface`. It is the only thing that makes a body legal,
it names the symbol it covers, and it covers nothing else. Absent the marker, a body is a finding —
`verify` reports it and the `budget-check` hook cannot see it, which is why the marker is explicit
rather than inferred. Never add the marker on your own judgment: the human asks, or there is no body.

**The test: could the implementer type this from the sketch?** If yes, the sketch is enough and the
body is noise. `stat -f%z` vs `stat -c%s`, `set -euo pipefail`, the exact `jq` filter, the real
`$REPO` paths, the literal byte counts — every one of those is a choice the implementer makes while
looking at the actual repo, and none is a choice a human approves at the gate.

**A command someone runs is not a body.** The rule is about code that ships in the repo, so it never
reaches a literal invocation: the Autotest **Command**, a **Manual test** step, the arguments in a
contract block. Those are required to be literal — `make run-dev`, `go test ./pkg/auth/...`, the exact
`curl` — because a human or CI types them verbatim and an approximation is useless. The line is
whether the text becomes a file in the repo or gets typed at a prompt.

**When the whole deliverable is a body** — a check script, a migration, a test file, a generated
query — the file has no surface at all. `## Surface` carries its contract as a plain fenced block (how
it is invoked, what it takes, what it exits with, what it prints), and the increment that builds it
carries `Surface: none` plus a **Behavior** sketch naming the checks in order and, above all, **the
edge cases**: the state that must not be reached, the second run that must not refetch, the env var
that must be unset, the count that must match. The edge cases are the part a human can only get from
this file; the mechanics are the part they can only get from the repo.

Worked example of exactly this shape: `examples/todo.md` § Surface (the `scripts/release-check.sh`
block) and `examples/todo-agent.md` § Changes, increment 4.

## How the increments reach the commit

Executed by `impl:sub-impl.md`, stated here so the human knows what an approval buys: increment 1
creates the commit; each later approved increment is appended to that same commit
(`git commit --amend --no-edit`), except an increment that corrects work the human rejected — that
one lands as a fixup (`impl:sub-commit.md` § Fixups). The final message is `TODO-N.md` `## Commit`.
A rejected increment stops the TODO — nothing after it is applied.
