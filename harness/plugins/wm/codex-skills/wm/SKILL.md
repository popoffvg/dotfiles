---
name: wm
description: Run WM spec, implementation, research, or review workflows when the user requests WM or invokes a WM operation.
---

# WM in Codex

Read [the Codex runtime](references/runtime.md) before executing a route. The plugin root is
two directories above this skill directory; resolve it from this file's installed location.

| Request | Guide relative to the plugin root |
|---|---|
| `code <subcommand>` or a bare code subcommand | [code](../../skills/code/SKILL.md) |
| `review <mode>` | [review](../../skills/review/SKILL.md) |
| `dive <subcommand>` | [dive](../../skills/dive/SKILL.md) |
| Another WM skill by name | `skills/<name>/SKILL.md` |
| `help` or WM without an operation | Print this table; `<router> help` prints that router's operation table. |

Invoke as `$wm code new`, `$wm code impl TODO-1`, `$wm review diff`, or `$wm dive docs <entry-point>`.
Treat `/wm:<router>:<operation>` as the same route when supplied in a request. Read the selected
router, then the reference its row names; the source router owns defaults and operation rosters.
