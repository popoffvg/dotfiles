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

## Autoresearch rules

**Eval checklist:**
1. Was `_notes/` directory created with `git init`?
2. Was `.pi/work.settings.json` created with phase=plan?
3. Did the extension inject the work:plan skill after initialization?
4. Were zero user questions asked during start (planning happens in plan phase)?

**Test inputs:**
- "Start new work on existing feature branch"
- "Start new work from main branch"
- "Start work when _notes/ already exists from previous run"

**Can change:** initialization steps, default settings values, worklog template
**Cannot change:** automatic flow (no user questions), _notes/ as working directory, plan phase as initial phase
**Min sessions before eval:** 5
**Runs per experiment:** 3
