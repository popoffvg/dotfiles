#!/usr/bin/env bash
# Desktop notification, or nothing at all. `notify.sh <title> <message>`
#
# The one platform-specific call in the plugin, kept behind this shim so the
# scan itself stays portable: osascript on macOS, notify-send on Linux,
# powershell toast on Windows, silence anywhere else. A missing notifier is
# never an error — the scan's real output is the record on disk, and the
# notification is a courtesy.
set -euo pipefail

title=${1:-self-improvement}
message=${2:-}

if command -v osascript >/dev/null 2>&1; then
  osascript -e "display notification $(printf '%s' "$message" | sed 's/"/\\"/g;s/^/"/;s/$/"/') with title \"$title\"" \
    >/dev/null 2>&1 || true
elif command -v notify-send >/dev/null 2>&1; then
  notify-send "$title" "$message" >/dev/null 2>&1 || true
elif command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -Command "New-BurntToastNotification -Text '$title','$message'" \
    >/dev/null 2>&1 || true
fi
exit 0
