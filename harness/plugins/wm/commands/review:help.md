---
name: review:help
description: Show all /review modes, with one-line descriptions.
---

Print the following table verbatim. No preamble, no commentary, no tool calls — output only the markdown below.

## `/review <mode>` — full list

| Mode | What it does |
|---|---|
| `diff` *(default)* | Run reviewrules over a loose diff (the working tree, `last`, a branch, a sha or range, or a PR) against the repo rules, the `wm` skill rules, and the ADR rules of `.notes/adr/`. Reports once and stops. |
| `todo` | Run reviewrules over the commits of one TODO against the same rules. `/code auto` and `/code impl` run it per TODO and per increment. |
| `help` | This page. |

## What one review runs

One `reviewrules` run in the background. It reads the diff once in a parent session, then forks it once per rule whose scope matches a changed file, with the model, effort, and steps of the rule's profile (`light`, `medium`, `heavy`). A generator fork writes correctness hypotheses, and a checker fork answers them.

Exit 0 is green, 1 is a FAIL or a confirmed hypothesis, and 2 is a run that did not finish. The summary goes to `<notes-dir>/review/<target>/report.md`, and the full JSON report goes to `reviewrules.json` beside it. `<target>` is `TODO-N`, or the slug of the range in `diff` mode.

Every mode asks one question: **is this built right?** Read-only on source: the forks have only read tools.

`/code review <mode>` and `/wm:code:review <mode>` are aliases.
