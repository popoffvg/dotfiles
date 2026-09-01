---
allowed-tools: Read, Glob, Grep, Bash(line-comment-lsp:*), Bash(ls:*)
description: Leave review comments on lines in Zed instead of writing them in chat
---

Place each remark on the line it is about, with `line-comment-lsp comment <file>:<lines> <text>`,
where `<lines>` is `12` for one line or `12-18` for a block. The comment shows in Zed at the
end of the first line and underlines every line it covers in the diagnostics panel. Nothing
is written into the file.

$ARGUMENTS names what to comment on. With no argument, comment on the working-tree diff.

Rules:

- One comment per starting line. A second comment starting on the same line replaces the first.
- Aim at the line the remark is about, not the top of the function. Use a span only when the
  remark is about a block as a whole, and address it by its first line afterwards.
- Say what is wrong and what to do. A remark that needs no action does not earn a comment.
- Keep the text to one or two sentences. The line shows the first 40 characters; the rest
  is in the tooltip and the export.
- `line-comment-lsp drop <file>:<line>` removes one, `line-comment-lsp list` prints them all.
- A comment on a file the operator has open appears within a second. On a closed file it
  appears when the file is opened.

Then print one line per comment placed, and nothing else:

```
<file>:<line> — <comment text>
```

No summary, no count, no restatement of what was reviewed.
