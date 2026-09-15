---
name: mutation
user-invocable: false
description: >
  Judge a test set by breaking the code it covers — apply one small behavior-changing edit at a
  time (a **mutant**) to the source the diff touched, re-run the tests that cover it, and report
  every mutant the suite let live. A survivor names the assertion nobody wrote. Runs as a batch of
  `mutation-tester` agents, one per changed source file, each in its own git worktree so the
  working tree is never mutated. No external mutation tool: the model writes the edit. Load it from
  the `mutation` gate of `review:ref-gates.md`, or whenever a diff's tests look green but untested.
---

# mutation — the tests are judged by the code they fail to catch

A passing suite proves the tests ran. It does not prove they assert anything. Mutation testing
settles that: change the behavior of the code, and the test that covered it must go red.

| Term | Meaning |
|---|---|
| **mutant** | One small edit to shipped source that changes observable behavior. One edit per run — never two at once. |
| **killed** | At least one test failed under the mutant. That test asserts the behavior. |
| **survived** | Every covering test still passed. Nothing asserts the behavior the edit changed. |
| **equivalent** | The edit cannot change any observable behavior, so no test could kill it. Reported, never a failure. |

The operators that make a mutant, and the rows that make one equivalent, are
@references/ref-operators.md. Read it before spawning anything.

## Run it

### 1. Resolve the surface

Take the diff the caller names and keep the **source** files it changed — a test file is what is
being judged, never what is mutated. Drop generated files, fixtures, and files with no covering
test; a file no test reaches is the test gate's finding, not this skill's.

Done when you have a list of `<source file> → <the command that runs its covering tests>`. The
command comes from `toolchain.json` (`review:ref-gates.md` § One toolchain run per round), narrowed
to that file's package or test path so a mutant run costs seconds and not the whole suite.

### 2. Batch the surface — one batch per source file

One `mutation-tester` agent per batch. A file with more than 200 changed lines splits into one
batch per changed symbol; a group of files under 20 changed lines each merges into one batch.

Done when no batch holds more than ~200 changed lines and no batch is empty.

### 3. Pick the run mode

| Batches | Mode |
|---|---|
| 2 or more | One git worktree per agent — spawn with `isolation: "worktree"`. The agents mutate at the same time and never see each other's edits. |
| exactly 1, run standalone | In place, in the working tree. The agent reverts each mutant before it writes the next, and the tree is clean when it returns. |
| exactly 1, run inside the review wave | **Still a worktree.** Five other gates read that same working tree in the same moment; a mutant they read is a finding they invent. |

A worktree costs a build: a fresh checkout has no `node_modules`, no `target/`, no compiled cache.
The agent's baseline step (§ 4) is what says whether that cost was payable — a worktree that cannot
run the suite returns `n/a`, never a guess.

**Inside a batch the mutants run in parallel too.** `~/.claude/scripts/go-mutation-check.sh` splits
the agent's mutant list over one hardlinked sandbox per job, so a batch costs about one test run per
job and not one per mutant. Its coverage pass answers a mutant on an uncovered line without running
anything, so give every mutant its `<file>:<line>`.

### 4. Spawn the batch — one message, all agents

Spawn every `mutation-tester` in a single message, each with a brief carrying:

```
diff:      <the revision range or "working tree">
files:     <the batch's source files>
test:      <the narrowed command that runs their covering tests>
report:    <notes-dir>/review/<target>/mutation/<batch-slug>.md
round:     <n>
budget:    <mutants per batch — 12 by default, ranked by kill-value and cut to this number>
```

Each agent runs the unmutated command first — the **baseline**. A red or unbuildable baseline ends
that agent at `n/a` with the reason, because a suite that was already failing kills every mutant for
the wrong reason and a suite that runs nothing kills none.

Done when every agent has returned `PASS | FAIL | n/a` and written its report file.

### 5. Merge and rule

Collect the batches into one verdict.

| Verdict | When |
|---|---|
| **FAIL** | Any mutant survived or came back `UNCOVERED` and names a real gap — the report gives the file:line, the edit, and the assertion that would have killed it. |
| **PASS** | Every mutant was killed, or every survivor is an equivalent with its row named. |
| **n/a** | No batch could establish a baseline. Say which, and why — never report PASS for a suite that never ran. |

**Every survivor is a missing assertion, never a mutant to delete.** The output is the test to
write, pointed at the line the edit changed.

## The control every run needs

**A whole batch surviving is a broken test command, not a worthless test set.** Before reporting
12 survivors out of 12, re-run the batch's command with one deliberate break — delete a return
value the tests obviously read — and confirm it goes red. A command that cannot fail answers
exactly like a test set that asserts nothing.

## What this skill never does

**Never mutates a test file.** The tests are the thing under judgment; editing them changes the
answer instead of measuring it.

**Never leaves an edit behind.** In worktree mode the worktree is thrown away; in place, each
mutant is reverted before the next is written, and `git status` is clean at the end.

**Never commits, and never writes the missing test.** Writing it belongs to the sonnet test gate
(`review:ref-gates.md`). This skill reports the survivor and the assertion that closes it.

**Never runs per increment.** It needs a green suite and a real build, which an increment still
waiting for approval does not have. It runs per TODO and per diff.
