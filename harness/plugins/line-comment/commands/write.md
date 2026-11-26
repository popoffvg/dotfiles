---
allowed-tools: Read, Glob, Grep, Skill, Bash(printenv:*), Bash(line-comment-lsp:*), Bash(~/.claude/scripts/mized-mcp.sh:*), Bash(ls:*)
description: Leave review comments on lines in Zed instead of writing them in chat
---

Do this step first: run `printenv MIZED`, then load the `agent-to-user` skill. For output `1`, add each remark through its Live comments instructions, and do not run `line-comment-lsp`. For any other result, use `line-comment-lsp comment <file>:<lines> <text>`. The range is `12` for one line or `12-18` for a block.

$ARGUMENTS names what to comment on. With no argument, comment on the working-tree diff.

Rules:

- Use one comment per starting line. In miZed, list comments on the file before you add one. Update an existing comment only if it has `author: agent` and the same range. Otherwise preserve the comment and skip that target.
- Aim at the line the remark is about, not the top of the function. Use a span only when the
  remark is about a block as a whole, and address it by its first line afterwards.
- Say what is wrong and what to do. A remark that needs no action does not earn a comment.
- Keep the text to one or two sentences.

Then print one line per comment placed, and nothing else:

```
<file>:<line> — <comment text>
```

No summary, no count, no restatement of what was reviewed.
