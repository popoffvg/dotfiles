---
allowed-tools: Bash(line-comment-lsp:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/find-anchor.py:*)
description: Show the line comments the store still holds — the ones nobody has acted on
---

Read the store:

```
line-comment-lsp list
```

`/line-comment:act` drops every comment it acts on, so whatever the store still holds is
unresolved. Output holding only the `# line comments` header means nothing is open — say so
in one line and stop.

Print one line per comment and **nothing else**:

```
<file>:<line> — <comment text>
```

Edit no file, drop no comment, act on nothing. This command reports; `/line-comment:act` acts.

Rules:

- Keep the store's order. Group by file, and keep each file's lines in ascending order.
- A heading marked `(from Claude)` is a comment you placed yourself. Print it with a
  trailing ` (from Claude)` so the operator can tell it from their own.
- `(orphaned)` means the anchored line moved or was rewritten. Print the stored line number
  and append ` (orphaned)`. `${CLAUDE_PLUGIN_ROOT}/scripts/find-anchor.py --store
  .tmp/line-comment.json` prints which line still matches each stored anchor — run it only
  if the operator asks where an orphan went.
