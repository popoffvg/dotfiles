---
name: review:help
description: Show all /review modes and the gates they run, with one-line descriptions.
---

Print the following table verbatim. No preamble, no commentary, no tool calls — output only the markdown below.

## `/review <mode>` — full list

| Mode | Does |
|---|---|
| `diff` *(default)* | Judge a loose target against the rule files — the working tree, `last`, a branch, a sha or range, or a PR url. Resolves the target to one revision range, derives the intent sentence from the commit messages as context, then runs the chain. The test gate reports the missing test here and writes nothing. |
| `todo` | Judge an implemented TODO against the same rule files, plus the TODO's settled decisions as `D<NNN>` rules. A breach there is a Failure with a citation. The chain `/code auto` runs per TODO. |
| `help` | This page. |

## Speed — the second argument

| Speed | Runs |
|---|---|
| `normal` *(default)* | The whole chain: the wave with the mutation gate, then the test gate. `/code impl` runs it as the TODO review under `approve: todo` and `none`. |
| `fast` | The wave over the named diff — no mutation gate, no test gate. `/code impl` runs it over each increment under `approve: increment`. Sets no TODO `status`. |

## The gates each mode runs

| Gate | Judges | Model |
|---|---|---|
| lint | the repo's linter over the changed files, and the tests that cover them | haiku |
| rules | every rule in `<notes-dir>/rules/` and `~/.notes/rules/` — one `# H1` per rule — against each changed file in its scope: comments, names, test worth, tables, language rules, and the TODO's decisions. One haiku checker per batch of one file × up to six rules; one sonnet reducer drops false hits | haiku; reducer sonnet |
| idiom | every line the diff changes — written the way its language and pinned version expect | sonnet |
| correctness | the inputs that make the changed code give a wrong result — opus asks one yes/no question per suspected defect, one sonnet checker answers each | opus; checkers sonnet |
| mutation | whether the tests that exist assert anything — breaks the code and reports every test that stayed green | sonnet |
| test | does a test assert the contract — and writes it when none does | sonnet |

Order: `wm-rule-batches.py plan` cuts the rules into batches, then all judging agents run as one parallel wave — lint, every rule checker, idiom, correctness, and the mutation gate as one agent per changed-source batch. The rule reducer runs when the last rule checker returns; a (file, rule) pair with no verdict fails the gate. Then the sonnet test gate runs alone, because it writes. Any FAIL merges into one fixup brief for `/code fix` and restarts the chain at the plan step. A fixup that changes only comments re-runs only the rules gate and the gates that failed.

Every gate writes its own findings file: `<notes-dir>/review/<target>/<gate>.md` — mutation writes one per batch under `mutation/` — plus the merged `<notes-dir>/review/<target>/report.md`. `<target>` is `TODO-N`, or the resolved range slug in `diff` mode. Each round overwrites, so the files always show the current verdict — a green gate writes its file too, so a missing file means the gate did not run.

Every mode asks one question: **is this built right?** No gate judges the spec — the Outcome, the Surface, and drift belong to `/code verify` before the code exists and the `verifier` agent after it.

Read-only on source: every gate returns findings and applies none. Two exceptions: the sonnet test gate writes the missing test and leaves it uncommitted, and the mutation gate edits source inside its own throwaway worktree, never the tree you are reviewing.

`/code review <mode>` and `/wm:code:review <mode> [speed]` are aliases — same modes, same gates.
