#!/usr/bin/env bash
# EDITOR for a Zed terminal: open the files in the Zed window on screen, wait for
# the tabs to close, then press cmd-< so focus goes back to the agent thread.
# cmd-< must stay bound to agent::FocusAgent or agent::ToggleFocus in keymap.json.
# The key press needs Accessibility access for Zed (System Settings → Privacy).
set -euo pipefail

zed --existing --wait -- "$@"
osascript -e 'tell application "System Events" to key code 43 using {command down, shift down}' >/dev/null 2>&1 || true
