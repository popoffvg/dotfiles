---
name: review
description: >
  The judging half of the wm flow — subcommand router. Every operation that reads code and rules on
  it without writing any: the gate chain over one implemented TODO (todo), and the same gates over a
  loose diff, branch, PR, or working tree with no TODO pair (diff). Owns which gate judges what,
  which agent runs it, and at which model tier. Invoke as `/review <todo|diff>` (default `diff`);
  `/code review` is the same skill under its old name. Never edits source and never commits.
argument-hint: "[diff (default), todo — full list /review:help] + the target to judge"
---

# review — subcommand router

`/review <mode>`. Pick the mode, read its file in `commands/`, follow it. Default is `diff`.

`/code review <mode>` is an alias for this page and takes the same modes — the `code` router keeps
the row so the flow reads end to end, and owns nothing about judging.

Both modes ask one question — **is this built right?** — and run the same gates to answer it. They
differ only in how much the gates can cite. Whether the change is the *right thing* is settled
outside this skill, by `/code verify` before the code exists and the `verifier` agent after it. The roster — which gate judges what, which agent runs it, at which model tier, and how a
FAIL routes back — is one file: @references/ref-gates.md. Read it before either mode.

| Mode | Judges the diff against… | File |
|---|---|---|
| `diff` *(default)* | the repo's own rules alone — `CLAUDE.md`, the house style docs, the code around the diff, the language idiom. A loose diff, a branch, a PR, or the working tree. | `commands/sub-diff.md` |
| `todo` | the same, plus the rule sources the `TODO-N.md` + `TODO-N.agent.md` pair points at — the rules `~/.claude/scripts/wm-constraints.py` prints, plus `RULES.md` and `PATTERNS.md`. A breach there is a Failure with a citation. The chain `impl:sub-auto.md` runs per TODO. | `commands/sub-todo.md` |
| `help` | This page. | `SKILL.md` |

Pick `todo` when a `<notes-dir>/todos/TODO-N.md` covers the diff, `diff` when none does. A TODO
whose pair the diff has outgrown is still `todo` — the pair's rule files apply either way, and the
mismatch itself is for `/code verify`, not for a gate here.

## Examples

`examples/report.md` is the finished artifact filled with real content — one gate's own report file
and the merged `report.md` — and every piece carries its own rules as a `>` block underneath: what it
must contain, and when it is wrong. Copy the one you are writing, replace the content, delete the
`>` lines. A rule about one piece is written there and nowhere else.

## What this skill never does

**Read-only on source, always.** Every gate returns findings; the caller routes them back to
`impl`. No gate edits source, and no gate commits — with one named exception the roster states:
the test gate writes the missing test and leaves it uncommitted for the implementer to fold in.

**Every gate does write its own report**, to the `report:` path the caller names under
`<notes-dir>/review/<target>/`. That is a notes-dir file, not source, and it is not optional — a
green gate writes it too (@references/ref-gates.md § Every gate writes its report to a file).

**Judges how, never whether.** This skill rules on how the code is built — the rules it obeys, the
patterns it follows, the inputs that break it. Whether it should have been built at all, whether it
delivers its Outcome, and whether a rule was right are three other questions, owned by
`code:sub-verify.md`, the `verifier` agent, and `arch:sub-revise.md`. A gate that reports one of
them has left its scope.
