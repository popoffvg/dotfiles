---
name: draft
description: Write a markdown document from a prompt, then show it in the native review window and act on the reader's annotations. Invoke as `/show:draft <what to write>` when the user wants to see something as a document first — a plan, a spec, a summary, a comparison, an outline — and mark it up before anything is built.
argument-hint: <what the document should cover>
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/../../scripts/mdshow.sh *), Bash(mdshow *), Write, Edit
disable-model-invocation: true
---

Write the document the reader asked for, show it to them, and work their annotations back into it.
The document is the deliverable of this turn — do not start building what it describes.

## 1. Write the file

The reader's request: **$ARGUMENTS**

Pick the path:

- `.notes/drafts/<slug>.md` when a `.notes/` directory exists in the repo (create `drafts/`).
- otherwise `$TMPDIR/mdshow-drafts/<slug>.md` (create the directory).

`<slug>` is two or three words from the request, kebab-case. Say the path in one line, then write the
file with the Write tool.

Write it for annotation, not for prose flow:

- A short `#` title, then the content. No preamble about what you are about to write.
- One idea per block, separated by a blank line — each block is a thing the reader clicks to comment on.
- Put choices, options, and comparisons in a table or a numbered list, so a comment lands on one row.
- Mark anything you assumed or invented with a `> Assumption:` quote block. Those are what the reader
  most needs to correct.
- End with an `## Open questions` list if any real question remains. One question per list item.
- Research the repo first when the request is about this codebase. A document full of guesses wastes
  the reader's review.

## 2. Show it

```
${CLAUDE_SKILL_DIR}/../../scripts/mdshow.sh show <path>
```

Run that with the Bash tool — use that script path, not a bare `mdshow`, because a session started by
Zed or the desktop app does not have `~/.local/bin` on PATH. It waits for as long as the reader needs.
If the call is cut short before feedback arrives, the window is still open: run the same script with
`wait --last` and repeat until it prints feedback. Waiting is the work: do not review your
own document, do not guess the feedback, do not start other tasks.

## 3. Act on the annotations

| What came back | What to do |
|---|---|
| **Change these** | Edit those exact places in the file. Each item names `<file>:<line>` and quotes its block. |
| **Answer these** | Answer in your reply. Do not edit the document only to satisfy one of these. |
| **Overall** | Apply to the whole document. |
| Approved, no comments | Say so in one line, give the path, stop. |
| Closed without feedback | Stop and wait for the reader's next instruction. |

After applying **Change these** edits, show the revised file again with step 2 — the reader decides
when it is done, not you. Keep the same path each round so the file's history stays in one place.

Only build what the document describes when the reader asks for it in a later message.
