---
name: zed-title.sh
description: Write a state mark and the session name as the terminal title of one claude process in a Zed terminal, from the turn state file that hooks/turn-triage.py writes.
args: "<state-file> <title-file> <claude-pid> <tty>"
needs: jq; CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1 in the claude process
used_by: zed-claude (when ZED_TERM=true)
---
