---
allowed-tools: Read, Edit, Write, Skill, AskUserQuestion, Bash(ls:*), Bash(~/.claude/scripts/md-comment-find-anchor.py:*), Bash(~/.claude/scripts/md-comment-store.py:*)
description: Export the markdown comments from the md-comment store, act on them, then clear them
---

Write the export first, so the comments are the ones the store holds right now rather than
whatever Zed's `copy comments` last left behind:

```
~/.claude/scripts/md-comment-store.py export
```

Then read `.tmp/md-comment.md`. A file holding only the `# markdown comments` header means
no comments — say so in one line and stop.

Otherwise split the comments in two groups:

- **Clear** — the comment plainly states what to change. Act on it now.
- **Unclear** — the comment does not state what to change. Edit nothing for it yet; it goes
  to the grilling session.

Act on every clear comment first. Then, if any comment is unclear, invoke the `grilling`
skill through the Skill tool, passing the unclear comments (`<file>:<line> — <text>`, one
per line) as its arguments. The grilling session resolves them one question at a time. When
it reaches shared understanding, act on each resolved comment.

Clear every comment you acted on out of the store, in one call, naming each one:

```
~/.claude/scripts/md-comment-store.py clear <file>:<line>...
```

That drops the comments from `.tmp/md-comment.json` and re-renders the export, so the Zed
inlay hints and Hint diagnostics for those lines go away. Leave an unresolved comment in the
store. Tell the operator to run `editor: restart language server` on a markdown file in the
last line of your output, and only when at least one comment was cleared — the running
server holds the store in memory and overwrites the file on its next comment action.

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
