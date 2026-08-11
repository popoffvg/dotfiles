---
allowed-tools: Read, Glob, Grep, Bash(md-comment-lsp:*), Bash(ls:*)
description: Leave review comments on lines in Zed instead of writing them in chat
---

Place each remark on the line it is about, with `md-comment-lsp comment <file>:<line> <text>`.
The comment shows in Zed at the end of that line and in the diagnostics panel. Nothing is
written into the file.

$ARGUMENTS names what to comment on. With no argument, comment on the working-tree diff.

Rules:

- One comment per line. A second comment on the same line replaces the first.
- Aim at the line the remark is about, not the top of the function.
- Say what is wrong and what to do. A remark that needs no action does not earn a comment.
- Keep the text to one or two sentences. The line shows the first 40 characters; the rest
  is in the tooltip and the export.
- `md-comment-lsp drop <file>:<line>` removes one, `md-comment-lsp list` prints them all.
- A comment on a file the operator has open appears within a second. On a closed file it
  appears when the file is opened.

Then print one line per comment placed, and nothing else:

```
<file>:<line> — <comment text>
```

No summary, no count, no restatement of what was reviewed.
