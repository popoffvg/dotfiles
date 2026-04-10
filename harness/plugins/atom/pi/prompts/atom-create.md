# atom:create

1. Read `_notes/plan.md` in cwd. If missing, tell user to run `/atom:init`.
2. Ask user for subtask details in one prompt:
   - name (slug)
   - repos (comma-separated, default all)
   - description
   - acceptance criteria
3. Run from task root:
   - `mise r task-subtask <name> <repos>`
4. Work-manager init is already requested by the command via event `atom:subtask-init-request`.
   - Subtask settings are initialized in `subtasks/<name>/.pi/work.settings.json`
   - Context source is linked from parent `_notes/plan.md`
5. Ensure `subtasks/<name>/_notes/plan.md` contains Description, Acceptance Criteria, TODOs, Design Decisions.
6. Delete legacy `subtasks/<name>/TASK.md` if present.
7. Append parent `_notes/worklog.md`:
   - `- YYYY-MM-DD HH:MM: Subtask created: <name> (<repos>)`
8. Report subtask path, branch, and notes entrypoint.
