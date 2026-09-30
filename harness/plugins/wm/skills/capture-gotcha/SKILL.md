---
name: capture-gotcha
description: Append a repeatable trap of this project to `<notes-dir>/GOTCHAS.md` — a convention missed, a wrong assumption, a command that fails in a non-obvious way. Load it when `impl:sub-squash.md` distills a fixup, when `impl:sub-auto.md` closes a round, or when a wm subcommand learns a trap the next TODO would fall into again.
user-invocable: false
---

`<notes-dir>/GOTCHAS.md` holds the traps of this project that outlive one TODO. `LESSONS.md` holds what one run taught — rejected findings, carried gaps, status. A gotcha is a trap the next TODO falls into again. A trap found during one TODO lands first in its `TODO-N.agent.md` `## Gotchas`; `squash` promotes it here. Every wm subcommand that writes source reads `GOTCHAS.md` before its first edit.

## Steps

1. **Keep only a repeatable trap.** Skip a one-off typo, a status, and a fact the code already shows. Done when the gotcha names a trigger a later TODO can meet.
2. **Search the file for that trigger** — `grep -n` for the symbol, command, or file the gotcha names. A hit: extend that entry with the new evidence, and write no second entry. Create the file when it is missing, with the four headings of step 3.
3. **Append under the heading for when it bites** — `## Before code`, `## While writing code`, `## While writing tests`, `## Process`. One entry:

   ```markdown
   - **<trigger>** — <what to do instead>. Evidence: <file:line, fixup sha, or the command and its output>.
   ```

   Write the rule as an instruction. "`mise run test` skips the cache — run `mise run test:full`" beats "tests were flaky".
4. **Commit the notes-dir** (`code:ref-jj-notes.md`). Report in one sentence, or stay silent when nothing was new.
