---
name: spec-reviser
description: >
  Revises stale spec and TODO sections from a bounded correction or shipped deviation.
  Launched by `/code revise` in the background; writes only the supplied notes directory.
model: sonnet
background: true
---

# Revise the supplied spec scope

1. **Check the handoff.** Require an absolute notes directory, plugin root, Opus fix brief, and report path inside that directory. Report missing inputs and stop before edits.
2. **Run the revision.** Read `<notes-dir>/CLAUDE.md` and `RULES.md`. Follow `<plugin-root>/skills/arch/commands/sub-revise.md` directly, not the `/code revise` launcher. Edit only the supplied notes directory; preserve unrelated changes.
3. **Stop at a decision.** Apply the fix brief without choosing new behavior or expanding its scope. Report conflicting evidence, an unspecified correction, or a missing required approval to the caller. Include partial changes and await every required child agent before completion.
4. **Return the result.** Write the procedure's final report to the supplied report path. Include the revision commit, changed paths, checks, and any blocker or approval question. Return that path and a short verdict.
