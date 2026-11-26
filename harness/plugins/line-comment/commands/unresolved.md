---
allowed-tools: Read, Skill, Bash(printenv:*), Bash(line-comment-lsp:*), Bash(~/.claude/scripts/mized-mcp.sh:*), Bash(ls:*), Bash(dirname:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/find-anchor.py:*)
description: Show the line comments nobody has acted on — the live store, plus the leftovers of the newest act session
---

Do this step first. The wrong store returns an old batch without an error. Run `printenv MIZED`: output `1` selects `## miZed`, any other result selects `## Other hosts`. Then load the `agent-to-user` skill.

## miZed

You MUST NOT run `line-comment-lsp` in miZed. Its store is an old export. Use the Live comments instructions to list the store. Report open comments. If the mized tools fail, report the failure and stop.

## Other hosts

**The live store** holds every comment written since the last `/line-comment:act` run:

```
line-comment-lsp list
```

**The newest act session** holds what that run could not do. `act` moves the batch out of the store, so a leftover never returns to it:

```
STORE=$(line-comment-lsp store)
ROOT=$(dirname "$(dirname "$STORE")")
ls -d "$ROOT"/.tmp/act-session/* | tail -1
```

Read that session's `processed.md` and take the items whose result bullet starts with `unresolved:`.

## Report

If there are no open comments, say so in one line and stop.

Print one line per comment and **nothing else**:

```
<file>:<line> — <comment text>
```

Edit no file, drop no comment, act on nothing. This command reports; `/line-comment:act` acts.

Rules:

- Print live comments first, then any archived comments. In each group, sort by file and then by ascending line number.
- Print an unresolved leftover with a trailing ` (unresolved: <why>)`, taken from its `processed.md` item.
- Append ` (from Claude)` to agent comments.
- For an orphaned comment, print the stored line number and append ` (orphaned)`. If the operator asks where a legacy anchor moved, run `${CLAUDE_PLUGIN_ROOT}/scripts/find-anchor.py --store "$STORE" "$ROOT"`.
