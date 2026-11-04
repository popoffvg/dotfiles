---
name: zed-focus-agent.sh
description: Presses cmd-< with osascript so the Zed window in front moves focus back to its agent thread.
args: none
needs: cmd-< bound to agent::FocusAgent in keymap.json; Accessibility access for Zed (for the osascript key press)
used_by: zed-edit-return.sh; the annotate-last Claude Code mod (after the reply tab closes)
---
