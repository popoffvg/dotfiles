#!/bin/bash
# Capture what a hung interactive `cursor-agent` (the `agent` CLI) is blocked on.
# Usage: start `agent` in another terminal, let it hang at the banner, then run this.
# Idempotent: safe to run repeatedly. Writes a report to $TMPDIR and prints its path.

set -uo pipefail

OUT="${TMPDIR:-/tmp}/cursor-agent-hang-$(date +%Y%m%d-%H%M%S).txt"

PID="$(pgrep -fl 'local/bin/agent' | grep -vi 'agent-review\|claude' | awk '{print $1}' | head -1)"
if [ -z "${PID:-}" ]; then
  # fall back: any node running the cursor-agent index.js
  PID="$(pgrep -fl 'cursor-agent/versions' | awk '{print $1}' | head -1)"
fi

if [ -z "${PID:-}" ]; then
  echo "No live cursor-agent process found. Start \`agent\` and leave it hung, then re-run." | tee "$OUT"
  exit 1
fi

{
  echo "===== cursor-agent hang report ====="
  echo "PID: $PID   time: $(date)"
  echo
  echo "===== process tree ====="
  ps -o pid,ppid,stat,etime,command -p "$PID" 2>&1
  pgrep -P "$PID" | while read -r c; do ps -o pid,ppid,stat,command -p "$c" 2>&1; done
  echo
  echo "===== open network sockets (lsof -nP -p PID, network only) ====="
  lsof -nP -p "$PID" 2>/dev/null | grep -iE 'TCP|UDP|->' || echo "(none)"
  echo
  echo "===== all open files (lsof -p PID) ====="
  lsof -nP -p "$PID" 2>/dev/null
  echo
  echo "===== sample (3s) ====="
  sample "$PID" 3 2>&1 | sed -n '1,120p'
} | tee "$OUT"

echo
echo "Report saved to: $OUT"
