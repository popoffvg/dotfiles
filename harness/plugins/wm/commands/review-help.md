---
name: review-help
description: Show all /review modes and the gates they run, with one-line descriptions.
---

Print the following table verbatim. No preamble, no commentary, no tool calls — output only the markdown below.

## `/review <mode>` — full list

| Mode | Does |
|---|---|
| `diff` *(default)* | Judge a loose target against the repo's own rules — the working tree, `last`, a branch, a sha or range, or a PR url. Resolves the target to one revision range, derives the intent sentence from the commit messages as context, then runs the chain. The test gate reports the missing test here and writes nothing. |
| `todo` | Judge an implemented TODO with the rule files its `TODO-N.md` + `TODO-N.agent.md` pair points at — `CONSTRAINTS.md`, `RULES.md`, `PATTERNS.md`. A settled `R<n>` rule broken is a Failure with a citation. The chain `/code auto` runs per TODO. |
| `help` | This page. |

## The gates each mode runs

| Gate | Judges | Model |
|---|---|---|
| lint | the repo's linter over the changed files, and the tests that cover them | haiku |
| comment | every comment, doc line, and doc tag the diff adds or changes | haiku |
| name | every name the diff declares — the `pedant` smell table | haiku |
| test worth | every test the diff adds — drops the ones asserting nothing the code can get wrong | haiku |
| test | does a test assert the contract — and writes it when none does | sonnet |
| standards | the repo's written rules, the patterns already in use, the language idiom, correctness | opus |

Order: the four haiku gates run as one parallel wave, then the sonnet test gate, then the opus standards gate. Any FAIL merges into one fixup brief for `/code fix` and restarts the chain at the wave.

Every gate writes its own findings file: `<notes-dir>/review/<target>/<gate>.md`, plus the merged `<notes-dir>/review/<target>/report.md`. `<target>` is `TODO-N`, or the resolved range slug in `diff` mode. Each round overwrites, so the files always show the current verdict — a green gate writes its file too, so a missing file means the gate did not run.

Every mode asks one question: **is this built right?** No gate judges the spec — the Outcome, the Surface, and drift belong to `/code verify` before the code exists and the `verifier` agent after it.

Read-only on source: every gate returns findings and applies none. The one exception is the sonnet test gate, which writes the missing test and leaves it uncommitted.

`/code review <mode>` is an alias — same modes, same gates.
