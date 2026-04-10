# atom:recall [--raw] [--deep] [topic]

1. Read `_notes/plan.md` in cwd.
2. If missing, scan immediate subdirectories for `*/_notes/plan.md`.
   - If one found, use it.
   - If multiple, ask user which one.
   - If none, tell user to run `/atom:init`.
3. If `--deep`, read relevant `_notes/*.md` files and synthesize comprehensive status.
4. If topic is provided, show matching note file.
5. Report: goal, done/pending criteria, next TODO, and available notes.
6. Ignore Work Manager settings/state/rules during recall (no phase policy enforcement here).
7. Append to `_notes/worklog.md`: `- YYYY-MM-DD HH:MM: atom:recall`.
