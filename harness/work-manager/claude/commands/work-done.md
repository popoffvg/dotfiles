---
name: work-done
description: Mark work complete
---

1. Call `work_state` MCP tool (action: read) to get current state
2. If phase is not "verified" — warn: "Work has not been verified yet. Are you sure?"
3. Call `work_state` MCP tool (action: update, updates: { status: "done" })
4. Confirm: "Work marked as complete."
