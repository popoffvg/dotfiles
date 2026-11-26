---
name: task-activity.py
description: Print the operator time and the agent time of one task per TODO and per day, from the Claude Code transcripts whose project folder name matches.
args: "<match> [--since YYYY-MM-DD] [--human-gap 30] [--solo 5] [--agent-gap 10] [--json]"
needs: python3
used_by: project-status skill
---
