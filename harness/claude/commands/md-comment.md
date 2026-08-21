---
allowed-tools: Read, Edit, Write, Skill, AskUserQuestion, Bash(md-comment-lsp:*), Bash(ls:*), Bash(~/.claude/scripts/md-comment-find-anchor.py:*)
description: Read the line comments from the md-comment store, act on them, then drop them
---

Read the comments the store holds right now, rather than whatever Zed's `copy comments` last
left in the export:

```
md-comment-lsp list
```

Output holding only the `# line comments` header means no comments — say so in one line and
stop.

A heading marked `(from Claude)` carries a comment you placed yourself. Report it, act on
none of it — it is not a task the operator gave you.

Otherwise split the operator's comments in two groups:

- **Clear** — the comment plainly states what to change. Act on it now.
- **Unclear** — the comment does not state what to change. Edit nothing for it yet; it goes
  to the grilling session.

Act on every clear comment first. Then, if any comment is unclear, invoke the `grilling`
skill through the Skill tool, passing the unclear comments (`<file>:<line> — <text>`, one
per line) as its arguments. The grilling session resolves them one question at a time. When
it reaches shared understanding, act on each resolved comment.

Drop every comment you acted on, in one call, naming each one:

```
md-comment-lsp drop <file>:<line>...
```

That drops them from `.tmp/md-comment.json`, and the running language server takes the write
up through its watch on the store — so the Zed inlay hints and Hint diagnostics for those
lines go away on their own, with no restart. Leave an unresolved comment in the store.

Then print one block per comment — clear and unclear alike — and **nothing else**:

```
<file>:<line> — <comment text>
  → <what changed, or "unresolved: <why>">
```

No investigation narrative, no account of how the referent was located, no closing summary,
no restatement of the comments before acting. Do the work first, print the outcome. The
grilling session's own output contract (summary, decision log, unknowns, next actions) is
replaced by this block — do not print it.

Rules while acting:

- Each comment is a task on that file and line.
- A comment left undecided by the grilling session gets `→ unresolved: <one line>`, no edit,
  and stays in the store.
- `(orphaned)` means the anchored line moved or was rewritten. Locate the text the comment
  was written on before acting; `~/.claude/scripts/md-comment-find-anchor.py --store
  .tmp/md-comment.json` prints which line still matches each stored anchor.
