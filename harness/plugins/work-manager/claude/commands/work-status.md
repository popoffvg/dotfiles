---
name: work-status
description: Show current work state and progress
---

1. Call `work_state` MCP tool (action: read)
2. If no active work — suggest `/work:start`
3. Read `_notes/plan.md` for plan overview
4. Read recent entries from `_notes/worklog.md` (last 10 lines starting with "- ")
5. Display:
   - Work ID / name
   - Current phase
   - Plan summary (acceptance criteria count, TODO progress)
   - Recent worklog entries
