---
name: review
description: >
  The judging half of the wm flow — every operation that reads code and rules on it without
  writing any: the gate chain over one implemented TODO (todo), and the same gates over a loose
  diff, branch, or working tree with no TODO pair (diff). Owns which gate judges what, which
  agent runs it, and at which model tier. Load it when the `code` skill routes to review, or when
  `auto` reaches its gate chain. Never edits source and never commits.
user-invocable: false
---

# review — the judging operations

The `code` skill routes here. Pick the mode, read its file in `commands/`, follow it.

Both modes run the same gates over the same diff; they differ only in what the gates are judged
against. The roster — which gate judges what, which agent runs it, at which model tier, and how a
FAIL routes back — is one file: @references/ref-gates.md. Read it before either mode.

| Mode | Judges the diff against… | File |
|---|---|---|
| `todo` | the `TODO-N.md` + `TODO-N.agent.md` pair plus `CONSTRAINTS.md` — the Outcome, the Surface, the rules the human approved. The chain `impl:sub-auto.md` runs per TODO. | `commands/sub-todo.md` |
| `diff` | the repo alone — no pair exists. A loose diff, a branch, a PR, or the working tree. | `commands/sub-diff.md` |

Pick `todo` when a `<notes-dir>/todos/TODO-N.md` covers the diff, `diff` when none does. A TODO
whose pair the diff has outgrown is still `todo` — the drift is the finding, not a reason to skip
the pair.

## What this skill never does

**Read-only on source, always.** Every gate returns findings; the caller routes them back to
`impl`. No gate edits a file, and no gate commits — with one named exception the roster states:
the test gate writes the missing test and leaves it uncommitted for the implementer to fold in.

**Judges, never designs.** A finding that the spec itself is wrong is drift, and drift routes to
`code:sub-revise.md`. This skill rules on whether the code keeps the spec, never on whether the
spec was right.
