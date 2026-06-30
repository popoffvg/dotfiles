---
name: inline-review-todos
description: Place PR/code-review comments as inline TODO markers at each comment's location, not in a centralized list. Use when asked to "write TODOs for PR comments", capture review feedback as TODOs, or turn review threads into actionable in-file notes.
---

# Inline review TODOs

Turn each review comment into an inline marker at the location it targets.

- One marker per comment, placed at (or adjacent to) the commented line — never collected into one central tracking file.
- Format: `TODO[PR]: <comment text> (@author)`. As an HTML comment (`<!-- TODO[PR]: … -->`) when the marker must not show in output.
- Preserve the comment's substance; attribute the author.

## Generated/rendered files

A comment on a generated file (a render, a compiled doc, codegen output) cannot live there — regeneration wipes it.

- Route the marker to the **source** that produces that line (the template, the atom, the source-of-truth file).
- Record the original location in the marker (e.g. `from README:80`) so the comment stays traceable to where the reviewer saw it.
- Do not regenerate after inserting working markers, or they leak into the output.

## Mapping comments to source

- Read the generated file to find which source section produces the commented line.
- When the exact source line is ambiguous, attach the marker to the owning unit (the atom/section), not a guessed line.
- Markers that recur across reviewers cluster naturally — group them when addressing, not when capturing.
