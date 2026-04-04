---
name: work-start
description: >
  Start new work. The /work:start command handler in the work extension
  does all initialization automatically — no skill injection needed.
  This file exists for documentation only.
---

# work:start

Handled entirely by the work extension:

1. Detects branch and parses work-id
2. Creates `_notes/` with `git init`
3. Creates `worklog.md`
4. Commits initial state
5. Creates `.pi/work.settings.json` with phase=plan
6. Injects `work:plan` skill to start planning

No user questions asked — planning happens in the plan phase.
