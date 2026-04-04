# atom:update [progress message]

1. Read `_notes/plan.md`, `_notes/worklog.md`, and `_notes/README.md` (if present).
2. If `_notes/plan.md` is missing, tell user to run `/atom:init` and stop.
3. Apply updates from user message:
   - append progress to `_notes/worklog.md`
   - check completed criteria/TODOs in `_notes/plan.md`
   - capture substantial findings in `_notes/<topic>.md`
4. Keep links updated:
   - ensure note appears in `_notes/plan.md` Work Notes
   - ensure note appears in `_notes/README.md`
5. If note files exceed ~100 lines, split by focused topic.
6. Report exactly what changed.
