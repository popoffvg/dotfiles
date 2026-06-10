#!/usr/bin/env bash
# commit-index-refresh-bg.sh — fire-and-forget commit-index refresh.
# Used by the SessionStart hook: must return IMMEDIATELY (never block startup).
# Idempotent: if a refresh/index is already running, do nothing.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="${TMPDIR:-/tmp}/commit-index-refresh.log"

# already running? (refresh script or its flow.py index child)
if pgrep -f "commit-index-refresh.sh|commit-index/flow.py index" >/dev/null 2>&1; then
  exit 0
fi

nohup "$SCRIPT_DIR/commit-index-refresh.sh" >"$LOG" 2>&1 &
disown || true
exit 0
