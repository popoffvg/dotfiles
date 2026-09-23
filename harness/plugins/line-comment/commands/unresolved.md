---
allowed-tools: Bash(line-comment-lsp:*), Bash(ls:*), Bash(dirname:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/find-anchor.py:*)
description: Show the line comments nobody has acted on — the live store, plus the leftovers of the newest act session
---

Read both places a comment can still be open.

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

Read that session's `processed.md` and take the blocks whose result line starts with `unresolved:`.

Both places empty means nothing is open — say so in one line and stop.

Print one line per comment and **nothing else**:

```
<file>:<line> — <comment text>
```

Edit no file, drop no comment, act on nothing. This command reports; `/line-comment:act` acts.

Rules:

- Keep each source's order. Group by file, and keep each file's lines in ascending order.
- Print an unresolved leftover with a trailing ` (unresolved: <why>)`, taken from its `processed.md` block.
- A heading marked `(from Claude)` is a comment you placed yourself. Print it with a
  trailing ` (from Claude)` so the operator can tell it from their own.
- `(orphaned)` means the anchored line moved or was rewritten. Print the stored line number
  and append ` (orphaned)`. `${CLAUDE_PLUGIN_ROOT}/scripts/find-anchor.py --store "$STORE" "$ROOT"`
  prints which line still matches each stored anchor — run it only if the operator asks where an
  orphan went. Pass `<ROOT>` explicitly; the script otherwise resolves paths against the store's
  grandparent.
