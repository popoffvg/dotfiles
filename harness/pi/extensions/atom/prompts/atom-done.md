# atom:done <subtask_name>

1. Ensure `subtasks/<subtask_name>/` exists.
2. Read subtask results:
   - `subtasks/<subtask_name>/_notes/plan.md`
   - `subtasks/<subtask_name>/_notes/worklog.md`
   - fallback: `subtasks/<subtask_name>/TASK.md` (legacy)
3. Append parent `_notes/worklog.md` summary with key results.
4. Merge and cleanup:
   - `mise r task-subtask-done <subtask_name>`
5. If merge fails, report error and stop.
6. Append final parent worklog entry:
   - `- YYYY-MM-DD HH:MM: Subtask completed and merged: <subtask_name>`
7. Report merge status and touched repos.
