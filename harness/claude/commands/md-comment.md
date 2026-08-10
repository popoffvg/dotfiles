---
allowed-tools: Read, Bash(ls:*), Bash(~/.claude/scripts/md-comment-find-anchor.py:*)
description: Read the markdown comments exported from Zed, then act on them
---

Read `.tmp/md-comment.md` from the workspace root. A missing file, or one holding only the
`# markdown comments` header, means no comments — say so in one line and stop.

Otherwise act on every comment, then print one block per comment and **nothing else**:

```
<file>:<line> — <comment text>
  → <what changed, or "ask: <one question>">
```

No investigation narrative, no account of how the referent was located, no closing summary,
no restatement of the comments before acting. Do the work first, print the outcome.

Rules while acting:

- Each comment is a task on that file and line.
- A comment that does not plainly state what to change gets `→ ask: <one question>`, and
  nothing is edited for it. One question, no options essay.
- `(orphaned)` means the anchored line moved or was rewritten. Locate the text the comment
  was written on before acting; `~/.claude/scripts/md-comment-find-anchor.py --store
  .tmp/md-comment.json` prints which line still matches each stored anchor.
