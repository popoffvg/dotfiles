---
name: review
description: >
  The judging half of the wm flow — subcommand router. Every operation that reads code and rules on
  it without writing any: one implemented TODO (todo), and a loose diff, branch, PR, or working tree
  with no TODO pair (diff). Both run the `reviewrules` tool, which checks every rule in one fork per
  rule and the correctness hypotheses. Invoke as `/review <todo|diff>` (default `diff`);
  `/code review` is the same skill under its old name. Never edits source and never commits.
argument-hint: "[diff (default), todo — full list /review:help] + the target to judge"
---

# review — subcommand router

`/review <mode>`. Pick the mode, read its file in `commands/`, follow it. Default is `diff`.

`/code review <mode>` is an alias for this page and takes the same modes.

Both modes ask one question: **is this built right?** Both launch one `reviewrules` run over one
diff. The run, the rule sources, the exit codes, the report files, and how a FAIL routes back are in
@references/ref-reviewrules.md. Read it before either mode.

| Mode | What it does | File |
|---|---|---|
| `diff` *(default)* | Run reviewrules over a loose diff (the working tree, `last`, a branch, a sha or range, or a PR) against the repo rules, the `wm` skill rules, and the ADR rules of `.notes/adr/`. Reports once and stops. | `commands/sub-diff.md` |
| `todo` | Run reviewrules over the commits of one TODO against the same rules. `/code auto` and `/code impl` run it per TODO and per increment. | `commands/sub-todo.md` |
| `help` | This page. | `SKILL.md` |

Pick `todo` when a `<notes-dir>/todos/TODO-N.md` covers the diff, `diff` when none does.

## Examples

`examples/report.md` is a filled `report.md` with its rules as `>` blocks underneath.

## What this skill never does

**Read-only on source.** reviewrules forks have only read tools. The caller routes each finding back
to `impl`, which is the only skill that edits.

**Judges how, never whether.** Whether the code should exist, whether it delivers its Outcome, and
whether a rule is right are owned by `code:sub-verify.md`, the `verifier` agent, and
`arch:sub-revise.md`.
