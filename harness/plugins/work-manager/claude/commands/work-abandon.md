---
name: work-abandon
description: Mark work abandoned/complete
---

1. Call `work_state` MCP tool (action: read) to get current state
2. Run memory finalization flow via `context-done` skill to persist insights.
3. Ask user to confirm memory finalization succeeded.
4. If `worktreePath` and `worktreeBranch` are set: merge worktree branch into source branch, remove worktree, delete branch. Abort on merge conflicts.
5. Remove local `_notes/` directory for this work item.
6. Call `work_state` MCP tool (action: update, updates: { status: "done" })
7. Confirm: "Work finalized: worktree merged, insights saved, notes removed, status=done."
