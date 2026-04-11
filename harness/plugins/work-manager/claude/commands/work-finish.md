---
name: work-finish
description: Alias for work-done
---

Use the same flow as `work-done`:

1. Call `work_state` MCP tool (action: read) to get current state
2. Run memory finalization flow via `context-done` skill to persist insights.
3. Ask user to confirm memory finalization succeeded.
4. Remove local `_notes/` directory for this work item.
5. Call `work_state` MCP tool (action: update, updates: { status: "done" })
6. Confirm: "Work finalized: insights saved, notes removed, status=done."
