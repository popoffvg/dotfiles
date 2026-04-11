#!/usr/bin/env bash
# Ensures the memory-keeper daemon is running.
# Called by SessionStart hook — starts daemon if needed, returns health banner.
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$PLUGIN_ROOT/../common/server"
PID_FILE="$HOME/.claude/debug/memory-keeper.pid"
PORT="${MK_PORT:-7420}"

# Check if daemon is alive
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    # Already running — return health banner
    BANNER=$(curl -sf "http://127.0.0.1:$PORT/api/health-banner" 2>/dev/null || echo "")
    if [ -n "$BANNER" ]; then
      echo "{\"additionalContext\": \"$BANNER\"}"
    else
      echo '{}'
    fi
    exit 0
  fi
  # Stale PID file — remove it
  rm -f "$PID_FILE"
fi

# Start daemon in background
cd "$SERVER_DIR" && nohup npx tsx daemon.ts > /dev/null 2>&1 &
sleep 1

# Return health banner from newly started daemon
BANNER=$(curl -sf "http://127.0.0.1:$PORT/api/health-banner" 2>/dev/null || echo "")
if [ -n "$BANNER" ]; then
  echo "{\"additionalContext\": \"$BANNER (just started)\"}"
else
  echo '{}'
fi
