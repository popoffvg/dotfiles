#!/usr/bin/env bash
# Press cmd-< in the frontmost app, so a Zed window moves focus to its agent thread.
# cmd-< must stay bound to agent::FocusAgent or agent::ToggleFocus in keymap.json.
# The key press needs Accessibility access for Zed (System Settings → Privacy).
set -euo pipefail

osascript -e 'tell application "System Events" to key code 43 using {command down, shift down}' >/dev/null 2>&1 || true
