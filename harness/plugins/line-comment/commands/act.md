---
allowed-tools: Agent, Read, Edit, Write, Skill, AskUserQuestion, Bash(line-comment-lsp:*), Bash(ls:*), Bash(mkdir:*), Bash(mv:*), Bash(date:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/find-anchor.py:*)
description: Move the line comments into an act session folder, act on them in fork agents, then record the session as processed
---

## Claim the batch

Read the comments the store holds right now, rather than whatever Zed's `copy comments` last left in the export:

```
line-comment-lsp list
```

Output holding only the `# line comments` header means no comments — say so in one line, open no session, and stop.

Otherwise name the session and take its comments out of the live store:

```
STORE=$(line-comment-lsp store)
ROOT=$(dirname "$(dirname "$STORE")")
SESSION="$ROOT/.tmp/act-session/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SESSION" && mv "$STORE" "$SESSION/line-comment.json"
```

**The move is the claim.** A rename is atomic, so the batch this run owns is fixed the moment it lands in the session folder and cannot grow underneath the forks. The live store is left absent, the running server takes that up through its watch and clears every inlay hint and Hint diagnostic, and a comment written while the forks work starts a fresh store that this run never reads.

`line-comment-lsp store` names the store the comments came from — the project root, which is not always the current directory, because one Zed project holds several repositories and the server's root is the project.

## Act

A heading marked `(from Claude)` carries a comment you placed yourself. Report it, act on none of it — it is not a task the operator gave you.

A heading reading `lines <a>-<b>` is one comment about that whole block.

Otherwise split the operator's comments in two groups:

- **Clear** — the comment plainly states what to change.
- **Unclear** — the comment does not state what to change. It goes to the grilling session before anyone edits for it.

If any comment is unclear, invoke the `grilling` skill through the Skill tool first, passing the unclear comments (`<file>:<line> — <text>`, one per line) as its arguments. The grilling session resolves them one question at a time. Every comment it resolves joins the clear group; one it leaves undecided stays unresolved and nothing is edited for it.

**You edit nothing yourself. A fork agent makes every change.** A fork inherits this conversation, so it already knows what the grilling settled — the prompt names the work, never the history.

**One fork per file, every fork in one message.** Two comments on one file are one agent's work, in the order they appear; two files are two agents running at once. Comments on the same file never reach two agents, because two agents editing one file overwrite each other.

```
Agent(subagent_type: "fork", name: "fix-<file-stem>", prompt: "<the file, its comments, the contract below>")
```

Each prompt carries the file path, every comment on that file (`<lines> — <text>`, plus `(orphaned)` where the store said so), and this contract:

- Act on each comment as a task on that file and those lines. Edit that file only.
- Ask nothing and start no grilling. A comment you cannot act on comes back unresolved.
- `(orphaned)` means the anchored line moved or was rewritten. Locate the text the comment was written on before acting; `${CLAUDE_PLUGIN_ROOT}/scripts/find-anchor.py --store <SESSION>/line-comment.json <ROOT>` prints which line still matches each stored anchor. Pass `<ROOT>` explicitly — the script otherwise resolves paths against the store's grandparent, which is the session folder rather than the project.
- Return one line per comment and nothing else: `<file>:<line> — <what changed, or "unresolved: <why>">`.

## Record the session as processed

Write `<SESSION>/processed.md` — one block per comment, acted on and unresolved alike:

```
# act session <id> — processed

<file>:<line> — <comment text>
  → <what changed, or "unresolved: <why>">
```

**No comment is dropped, because none is left to drop.** The batch left the store when the file moved, so `line-comment-lsp drop` has nothing to do here and is not called. The session folder holds the whole record: `line-comment.json` is the batch exactly as the operator wrote it, `processed.md` is what became of each comment.

**An unresolved comment stays in the session folder.** It is not written back to the live store and its Zed hint does not come back, so `processed.md` is where a leftover is read. Say so in the report when a run leaves any.

Then print the same blocks to the operator and **nothing else**:

```
<file>:<line> — <comment text>
  → <what changed, or "unresolved: <why>">
```

Close with the session path on its own line, so the record is reachable.

The `→` line is the fork's own line for that comment, not a rewrite of it. No investigation narrative, no account of how the referent was located, no closing summary, no restatement of the comments before acting, nothing about which agent did what. Do the work first, print the outcome. The grilling session's own output contract (summary, decision log, unknowns, next actions) is replaced by this block — do not print it.
