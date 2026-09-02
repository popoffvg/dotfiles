---
allowed-tools: Agent, Read, Edit, Write, Skill, AskUserQuestion, Bash(line-comment-lsp:*), Bash(ls:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/find-anchor.py:*)
description: Read the line comments from the line-comment store, act on them in fork agents, then drop them
---

Read the comments the store holds right now, rather than whatever Zed's `copy comments` last left in the export:

```
line-comment-lsp list
```

Output holding only the `# line comments` header means no comments — say so in one line and stop.

A heading marked `(from Claude)` carries a comment you placed yourself. Report it, act on none of it — it is not a task the operator gave you.

A heading reading `lines <a>-<b>` is one comment about that whole block; it is dropped by its first line, `<a>`.

Otherwise split the operator's comments in two groups:

- **Clear** — the comment plainly states what to change.
- **Unclear** — the comment does not state what to change. It goes to the grilling session before anyone edits for it.

If any comment is unclear, invoke the `grilling` skill through the Skill tool first, passing the unclear comments (`<file>:<line> — <text>`, one per line) as its arguments. The grilling session resolves them one question at a time. Every comment it resolves joins the clear group; one it leaves undecided stays unresolved and nothing is edited for it.

## Fix in fork agents

**You edit nothing yourself. A fork agent makes every change.** A fork inherits this conversation, so it already knows what the grilling settled — the prompt names the work, never the history.

**One fork per file, every fork in one message.** Two comments on one file are one agent's work, in the order they appear; two files are two agents running at once. Comments on the same file never reach two agents, because two agents editing one file overwrite each other.

```
Agent(subagent_type: "fork", name: "fix-<file-stem>", prompt: "<the file, its comments, the contract below>")
```

Each prompt carries the file path, every comment on that file (`<lines> — <text>`, plus `(orphaned)` where the store said so), and this contract:

- Act on each comment as a task on that file and those lines. Edit that file only.
- Ask nothing and start no grilling. A comment you cannot act on comes back unresolved.
- `(orphaned)` means the anchored line moved or was rewritten. Locate the text the comment was written on before acting; `${CLAUDE_PLUGIN_ROOT}/scripts/find-anchor.py --store "$(line-comment-lsp store)"` prints which line still matches each stored anchor — `line-comment-lsp store` names the store the comments came from, which is the project root and not always the current directory.
- Return one line per comment and nothing else: `<file>:<line> — <what changed, or "unresolved: <why>">`.

## Drop and report

Drop every comment a fork changed something for, in one call, naming each one:

```
line-comment-lsp drop <file>:<line>...
```

That drops them from `.tmp/line-comment.json`, and the running language server takes the write up through its watch on the store — so the Zed inlay hints and Hint diagnostics for those lines go away on their own, with no restart. A comment left unresolved — by the grilling session or by its fork — stays in the store and is not dropped.

Then print one block per comment — acted on and unresolved alike — and **nothing else**:

```
<file>:<line> — <comment text>
  → <what changed, or "unresolved: <why>">
```

The `→` line is the fork's own line for that comment, not a rewrite of it. No investigation narrative, no account of how the referent was located, no closing summary, no restatement of the comments before acting, nothing about which agent did what. Do the work first, print the outcome. The grilling session's own output contract (summary, decision log, unknowns, next actions) is replaced by this block — do not print it.
