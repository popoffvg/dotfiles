---
name: zed-edit-return.sh
description: EDITOR for a Zed terminal that opens the file in the Zed window on screen, waits for the tab to close, and then moves focus back to the agent thread with cmd-<.
args: "<file>..."
needs: zed on PATH; cmd-< bound to agent::FocusAgent in keymap.json; Accessibility access for Zed (for the osascript key press)
used_by: zsh/dot-zshrc (EDITOR when ZED_TERM=true)
---
