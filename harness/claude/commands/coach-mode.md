---
description: Set or show prompt-coach mode (off | async | warn | strict | block)
argument-hint: "[off|async|warn|strict|block]"
---

Read `~/.claude/prompt-coach.json` (create with defaults if missing), then set `mode` to `$1` if provided. Valid values: `off`, `async`, `warn`, `strict`, `block`.

- **off** — disabled
- **async** — log only, no inline output
- **warn** — inline critique, never blocks (default)
- **strict** — inline critique; block only when score ≤ minScore
- **block** — block any flagged prompt

If no argument given, print the current config. After updating, echo the new mode and the meaning.

Use Read/Write tools. The file is JSON: `{ "mode": "warn", "minScore": 10, "budgetMs": 1500, "minPromptChars": 20, "model": "claude-haiku-4-5" }`.
