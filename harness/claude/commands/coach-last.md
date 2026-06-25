---
description: Show the prompt-coach critique of the most recent prompt
---

Read `$TMPDIR/prompt-coach/last.json` and pretty-print:
- The prompt (first 200 chars)
- Score and per-dimension breakdown
- Issues
- Suggested rewrite

If the file is missing, say so. If `skipped` is set, explain why (pre-filter found no issues).
