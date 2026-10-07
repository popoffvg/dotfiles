---
name: mutation
user-invocable: false
description: >
  Find the unit and table tests a change can delete — apply one small behavior-changing edit at a
  time (a **mutant**) to the code the tests cover, record which tests and table rows each mutant
  fails, and mark a test that kills nothing, or only what E2E or a kept test already kills. E2E
  tests are the reference and are never judged. Runs as at most two `mutation-tester` agents; every
  mutant lands in a sandbox copy, so the checkout is never edited. Load it from the `mutation`
  gate of `review:ref-gates.md`, or when a diff adds unit tests that look like noise.
---

# mutation — a test earns its place by killing a mutant nothing else kills

A passing test proves it ran. It does not prove it guards anything. Break the code it covers: a
test that never goes red, or goes red only where another test already does, can be deleted.

| Term | Meaning |
|---|---|
| **mutant** | One small edit to shipped source that changes observable behavior. One edit per run. |
| **candidate** | A unit test, or one row of a table test, the diff adds or changes. The only tests this skill may mark for deletion. |
| **reference** | The E2E tests, and the unit tests the diff did not touch. They are never judged; they decide what a candidate adds. |
| **kills** | The test failed under the mutant. |

| Verdict | The candidate | Do |
|---|---|---|
| KEEP | kills a mutant no reference and no other kept candidate kills | keep |
| USELESS | covers a mutated line and kills no mutant | delete, or add the assertion it lacks |
| E2E-COVERED | every mutant it kills, E2E kills too | delete |
| REDUNDANT | every mutant it kills, a reference or a kept candidate kills too | delete; the report names who covers it |
| NO-VERDICT | covers no mutated line | nothing — no mutant reached it |

The operators that make a mutant, and the rows that make one equivalent, are
@references/ref-operators.md. Read it before spawning anything.

## Run it

### 1. Resolve the candidates and the surface

**Candidates** are the unit tests and table rows the diff adds or changes, written as Go test ids:
`TestName`, or `TestName/row_name` for one row (spaces become `_`, as `go test -json` prints them).
An E2E test is never a candidate. No candidate → the gate is `n/a — no unit or table test changed`.

**The surface** is the source code the candidates call: the functions their bodies reach, in the
diff's changed files first. A test file is never mutated.

**The E2E command** is the `E2E` entry of `toolchain.json` in `todo` mode (`review:ref-gates.md` §
One toolchain run per round), or the repo's own E2E task in `diff` mode. None → judge without it:
no candidate can be E2E-COVERED.

Done when you have the candidate ids per package, the source files they call, and the E2E command
or `none`.

### 2. Batch by package — at most two batches

One `mutation-tester` agent per batch, and **at most two batches per wave**. Deal the packages that
hold candidates to the batch with fewer candidates so far. One package → one batch.

### 3. Point every agent at the checkout

Every agent runs against the code checkout itself: the working tree for a working-tree diff; for any other diff, a checkout whose `HEAD` is the diff's head and whose `git status` is clean. `~/.claude/scripts/go-test-worth.py` edits only hardlinked sandbox copies, so the batches run at the same time and the other gates of the wave read a tree that never changes.

**Spawn without `isolation: "worktree"`.** It makes a worktree of the repo the session runs in, and in the wm flow that can be the notes repo and not the code. When no such checkout exists, make one worktree for the whole wave: `git -C <code checkout> worktree add --detach $TMPDIR/mutation-<target> <head sha>`. Remove it with `git -C <code checkout> worktree remove --force <path>` when every agent has returned, a failed one too.

### 4. Spawn the batch — one message, all agents

```
checkout:    <the absolute path from § 3>
diff:        <the revision range or "working tree">
candidates:  <package> <test id>, one per line
unit:        <the go test command for each package, e.g. `go test ./installer/`>
e2e:         <the E2E command, or `none`>
report:      <notes-dir>/review/<target>/mutation/<batch-slug>.md
round:       <n>
budget:      <mutants per batch — 4 per candidate, at most 24>
```

Done when every agent has returned `PASS | FAIL | n/a` and written its report file.

### 5. Merge and rule

| Verdict | When |
|---|---|
| **FAIL** | A candidate is USELESS, E2E-COVERED, or REDUNDANT. Each is one Failure: the test id, the verdict, and who covers it. |
| **PASS** | Every candidate is KEEP or NO-VERDICT. |
| **n/a** | No candidate, or no batch could run a green baseline. Say which — never PASS for a suite that never ran. |

## What this skill never does

**Never judges an E2E test.** E2E tests are the reference; they decide what a candidate adds.

**Never mutates a test file, and never edits the checkout.** Every mutant lands in a sandbox copy that the script deletes.

**Never deletes a test, and never commits.** It names the test to delete; the implementer deletes it.

**Never runs per increment.** It needs a green suite and a real build. It runs per TODO and per diff.
