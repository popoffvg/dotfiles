# arch — what cuts across the TODO pair

**The rules for each section live in the filled artifacts**, one `>` block under the piece it governs:
[`examples/todo.md`](../examples/todo.md) (human half),
[`examples/todo-agent.md`](../examples/todo-agent.md) (agent half), and
[`examples/todo-test.md`](../examples/todo-test.md) (test file). Open the half you are writing and
read the block under each heading — there is no second copy of a section rule anywhere.

This file holds only what no single section owns: the prose rule both halves obey, where the
generated rules come from, the two doctrines that bound every diff in the pair, and what an approval
buys. `sub-todo.md` owns the procedure — the fan-out, the budgets, the verification chain, the
pre-save checklist. Which half each heading lives in: `sub-todo.md` § Required elements.

| Section | Half | Its rules |
|---|---|---|
| frontmatter (`status`, `type`, `depends_on`, `risk`, `size`, `approve`, `increment`) | `TODO-N.md` | `examples/todo.md` |
| Outcome, New terms, Components, Flow changes, Increments with their `### Commit` sections, Deviations | `TODO-N.md` | `examples/todo.md` |
| Autotest | `TODO-N.test.md` | `examples/todo-test.md` |
| Files, Pre-reads, Manual test, Gotchas | `TODO-N.agent.md` | `examples/todo-agent.md` |

## Every prose line

**Every prose line of `TODO-N.md` and `TODO-N.test.md` obeys the `i-have-adhd` skill.** The human half is read once, by a
person deciding whether to approve it — Outcome, New terms **Meaning**, Components **Role** and **Change**, each increment's summary and **Surprises**, flow steps,
Autotest cases, each commit **Body**, and any sentence beside a table. Load that skill and write under its rules: one
idea per sentence, short sentences, front-loaded, literal words, no restatement. The agent half is
read by an implementer and is not bound by it.

## Constraints — rules come from ADR Properties

The rules every increment obeys are **generated** from the Properties of the ADRs in `<notes-dir>/adr/`, never written by
hand. No pair file carries a rule or the command; `todos/CLAUDE.md` § Read order names the command
once (`examples/todos-claude.md`). Run
`~/.claude/scripts/wm-constraints.py <notes-dir>/adr --todo TODO-N` to see the set a TODO is bounded by; no
file in the corpus holds it.

**One row per Property of a live ADR.** The row id is `ADR-NNNN/Pn`, and its text is the
Property line verbatim, so the rule a reader obeys and the rule an author wrote are the same text.
`--todo TODO-N` prints the rows of every `architecture` and `feature` ADR plus the `implementation`
ADRs whose `todo:` is that row. An archived ADR and a dropped Property generate
nothing (`ref-adr-format.md` § Properties are the rules).

**In `adr/` — the Property, which *is* the rule.** There is no rules file to append to. A settled
decision an increment can violate is an ADR, and each of its Properties is one rule:

- **Write each Property as an invariant** that passes the option test of the `adr` skill. A line that restates the chosen option — a method list, a package path, a mechanism — goes in the ADR paragraph.
- **One ADR per decision** — two TODOs that obey one decision still cite one ADR.
- A new invariant of a recorded decision is a new Property of that ADR. A reversed
  decision is a new ADR that supersedes the old one (`ref-adr-format.md` § Refine in place, reverse
  by supersede).
- A fact no increment can violate is not a constraint. It lives in the research artifact that
  established it, and the `trace` skill still finds it through the ADR that cites it.

## A diff carries the change, not what the change forces

**A diff shows only the contract its increment decides.** A symbol that only *moves* to a contract
decided in another diff carries no diff of its own: a caller that passes the new argument, an
import updated after a symbol moves, a middle layer that only forwards a new field, a name replaced
at every use. Its diff is already fixed by the entry it follows, so writing it puts one decision in
two places — the same reason a body never appears here.

**The test: does the reader make a choice at this symbol?** Read the diff this one depends on, then
ask what this symbol can look like. One answer → it is a consequence; skip it. More than one answer → it is
a real decision; keep it. A caller that must *build* the new argument — pick a default, convert a
value, read a config key — decides what to pass, and that value is what the human approves. Keep the
deciding line alone, never the propagation around it.

**A skipped consequence still has a home.** The increment that changes the deciding symbol names the
broken callers in its **Surprises**. When a caller sits in another component, the next increment
moves it, and its summary says what the call does before and after; the agent half's `## Files`
keeps the paths under that increment's number. `examples/todo.md` § Increments already demands
this, which is why the diff can drop the consequence and lose nothing. A consequence-only file gets no
`## Components` node either — it holds no symbol this TODO decides.

## A diff carries the surface, not a body

A **body** is anything whose content *is* the implementation: a function or method body, a loop, a
branch chain, a shell script, a SQL query, a regex, a fixture, a table of literal expected values, a
test file's assertions. None of it goes in an increment's diff, and the reason is not length — it is
that a body written here is written twice. The implementer either copies it, in which case the review
happened against a paste; or improves it, in which case the TODO is wrong from the first commit.

**The default is absolute: never put a function body in the diff.** Not to show intent, not because
the body is short, not because it "clarifies" the signature. Show the signature; put each decision a reader cannot
guess in the increment's **Surprises**, and the steps in run order in `## Flow changes`.

**The one exception is a human asking for it directly.** When the human explicitly says they want a
body written out for a specific symbol, write it — and mark it, so the next reader can tell an
approved body from a smuggled one:

```
- **Body requested:** `Refresh` — the human asked for the full body on 2026-08-21.
```

That marker sits under the increment's diff. It is the only thing that makes a body legal,
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
query — the file has no surface at all. The increment that builds it carries its contract as a plain
fenced block under **Surface** (how it is invoked, what it takes, what it exits with, what it
prints), plus a summary naming the checks in order and a **Surprises** list carrying **the
edge cases**: the state that must not be reached, the second run that must not refetch, the env var
that must be unset, the count that must match. The edge cases are the part a human can only get from
this file; the mechanics are the part they can only get from the repo.

Worked example of exactly this shape: `examples/todo.md` § Increments, increment 3.1.

## How the increments reach their commits

Executed by `impl:sub-impl.md`, stated here so the human knows what an approval buys: increment
`c.1` creates commit `c` with the message of `### Commit c`; each later approved increment `c.i` is
appended to that same commit (`git commit --amend --no-edit`), except an increment that corrects work
the human rejected — that one lands as a fixup (`impl:sub-commit.md` § Fixups). Before increment
`c+1.1` starts, `impl` checks the border of commit `c`: the build, the existing tests, and the
cases its **Proves** line names. A commit is never amended after the next one starts.
A rejected increment stops the TODO — nothing after it is applied.
