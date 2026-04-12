---
name: work-done
description: >
  Mark active work as complete. Alternative to direct /work:done command.
---

# work:done

Finalize the current work item.

## Steps

1. Read current state via `work_state` (action: `read`)
2. Run memory finalization by loading and following `context-done` skill to persist insights.
3. Stop and wait for explicit user confirmation that memory finalization succeeded.
4. If `worktreePath` and `worktreeBranch` are set in state: merge the worktree branch back into the source branch (`branch` field), then remove the worktree and delete the worktree branch. If merge conflicts occur, stop and ask the user to resolve them.
5. Remove local `_notes/` directory for this work item.
6. Update state via `work_state` (action: `update`, updates: `{ status: "done" }`)
7. Confirm completion:
   - "Work finalized: worktree merged, insights saved, notes removed, status set to done."

## Notes

- This skill is a guided alternative to `/work:done`.
- If there is no active work settings file, report that clearly.
- If `_notes/` is missing, continue without failing.
- If memory finalization is blocked (missing config, permissions), stop and ask the user before deleting notes.
