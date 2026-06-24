---
name: work-spec-revise
description: Revise spec.md and todos/TODO-N.md so they match what the last commit related to TODO-N actually implemented.
argument-hint: <TODO-N> [<sha-or-range>]
---

Use the `code` skill's `revise` subcommand (`references/revise.md`) to update the spec to match reality.

Arguments: `$ARGUMENTS`

1. Parse `$ARGUMENTS` — first token is the TODO id (e.g. `TODO-3`). Optional second token pins a git SHA or range; otherwise discover the commit via worklog / `git log --grep`.
2. Follow the `code` skill's `revise` subcommand end-to-end:
   - Locate the commit(s) for the given TODO.
   - Inspect the diff (`git show <sha>`) and categorize deltas vs the current plan.
   - Update `<notes-dir>/spec.md` and `<notes-dir>/todos/TODO-N.md` so they reflect what actually shipped.
   - Append a worklog line.
3. **Do not modify source code.** Edits are limited to `<notes-dir>/`.
4. Stop after reporting the summary. Return control to the user.

If `$ARGUMENTS` is empty or the TODO id is missing, ask the user which TODO to revise — do not guess.
