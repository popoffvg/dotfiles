---
allowed-tools: Bash(line-comment-lsp:*)
description: Drop line comments from the store without acting on them
---

$ARGUMENTS names what to drop. With no argument, drop every comment.

| Argument | What goes |
|---|---|
| *(none)* | every comment in the store — `line-comment-lsp drop --all` |
| `<file>:<line>...` | just those comments |
| `<file>` | every comment on that file |
| `orphaned` | every comment the list marks `(orphaned)` |
| `mine` | every comment under a heading marked `(from Claude)` |

Read the store before dropping anything, so the report names what actually went:

```
line-comment-lsp list
```

Output holding only the `# line comments` header means nothing is stored — say so in one
line and stop. For an argument that selects a subset, pick the matching headings out of that
listing, then drop them by target in one call:

```
line-comment-lsp drop <file>:<line>...
```

Then print one line per comment dropped, and **nothing else**:

```
<file>:<line> — <comment text>
```

Edit no file, act on no comment. This command throws comments away; `/line-comment:act` is the
one that does the work first. If the argument selects nothing, say so in one line and drop
nothing.
