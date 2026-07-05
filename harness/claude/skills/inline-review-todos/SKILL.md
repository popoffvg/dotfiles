---
name: inline-review-todos
description: Place PR/code-review comments as inline TODO markers in the file each comment is on, at its line, not in a centralized list. Use when asked to "write TODOs for PR comments", capture review feedback as TODOs, or turn review threads into actionable in-file notes.
user-invocable: false
---

# Inline review TODOs

Write each review comment as an inline marker in the file it is on, at the commented line.

- One marker per comment, at (or adjacent to) the exact line — never collected into one central tracking file.
- Put it in the **same file the reviewer commented on**, including a generated/rendered file. Do not reroute the comment to a source/template file unless asked.
- Format: `TODO[PR]: <comment text> (@author)`. As an HTML comment (`<!-- TODO[PR]: … -->`) when the marker must not show in rendered output.
- Preserve the comment's substance; attribute the author.

## Placement

- Inside a code fence or table, place the marker just before/after the block (a marker between table rows or inside a fence corrupts rendering) and name the line/element it refers to.
- Match on the line's text, not a line number, so insertions don't shift later edits.

## Generated/rendered files

A marker in a generated file (a render, compiled doc, codegen output) is wiped on regeneration.

- Still place it there in place — that is where the reviewer saw the comment.
- Do NOT regenerate the file after inserting markers (it erases them).
- Flag the caveat: the markers must be addressed (and propagated to the source) before the next regenerate, or they are lost.
