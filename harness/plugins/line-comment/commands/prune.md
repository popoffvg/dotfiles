---
allowed-tools: Skill, Bash(line-comment-lsp:*), Bash(~/.claude/scripts/mized-mcp.sh:*)
description: Drop line comments from the store without acting on them
---

Load the `agent-to-user` skill and select the host. List comments from the selected store before you delete anything. Apply the same selection on either host.

$ARGUMENTS names what to drop. With no argument, select every comment.

| Argument | What goes |
|---|---|
| *(none)* | every comment in the store |
| `<file>:<line>...` | just those comments |
| `<file>` | every comment on that file |
| `orphaned` | every comment the list marks `(orphaned)` |
| `mine` | every comment under a heading marked `(from Claude)` |

## miZed

Use the Live comments instructions in `agent-to-user`. For a request to drop every comment, call `clear_comments` for the store. For a subset, confirm that the selection includes every comment on each affected file, including done comments. Clear each of those files by path. If any affected file contains a comment outside the selection, report that miZed can delete only by file or store and stop before deletion.

## Other hosts

```
line-comment-lsp list
```

Use `line-comment-lsp drop --all` for the whole store. For a subset, drop the matching targets in one call:

```
line-comment-lsp drop <file>:<line>...
```

## Report

Then print one line per comment dropped, and **nothing else**:

```
<file>:<line> — <comment text>
```

Edit no file, act on no comment. This command throws comments away; `/line-comment:act` is the
one that does the work first. If the argument selects nothing, say so in one line and drop
nothing.
