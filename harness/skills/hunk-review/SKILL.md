---
name: hunk-review
description: Drive a live Hunk diff review session from the terminal — read the file/hunk structure, move the user's view to a hunk, and pin inline review comments to exact lines. Use when the user runs `hunk diff` / `hunk show`, says "review this in hunk", "walk me through the diff", "comment on that hunk", or when a review gate has file:line findings to hand back. Never open the Hunk TUI yourself; talk to the running session with `hunk session *`.
---

# hunk-review

The procedures live with the tool, not here. Read the bundled skill before the
first `hunk session` call:

```bash
cat "$(hunk skill path)"
```

It covers session selection, `navigate`, `reload`, the `comment add` / `comment apply`
forms, and the error messages.

## Rules that outlive the bundled file

- The TUI is the user's. Never run `hunk diff`, `hunk show`, or `hunk patch` — they block.
- Start with `hunk session review --repo . --json` for structure. Add `--include-patch`
  only for the files you must read as raw diff text.
- Batch agent findings through one `hunk session comment apply --stdin`, not many
  `comment add` calls.
- Read the user's replies back with `hunk session comment list --repo . --type user`.

## Where it fits

- `/review` and `/test-suite verify` — hand each gate finding back as an inline comment
  instead of a wall of terminal text.
- `/smart-commit` — show the proposed hunks while the user answers the proposal file.
