---
name: skills-stats
description: Show skill usage statistics
---

Read `~/.pi/agent/skills-stats.json` and format a table of skill usage stats.

Columns: Skill | Uses | Sessions | Last Used | Friction | Turns | Score (from daily scores)

For the Score column, read the most recent file in `~/.pi/agent/skills-scores/` and show the last score for each skill.

Sort by Uses descending. Only show skills with at least 1 use.

If the file doesn't exist or is empty, say "No skill stats recorded yet."
