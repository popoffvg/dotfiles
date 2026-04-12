#!/usr/bin/env bash
# SessionStart hook — recover un-scored previous session.
# If JSONL exists from a previous session (crash/force-quit), score it now.

set -euo pipefail

JSONL_FILE="$HOME/.pi/agent/skill-stats-session.jsonl"

if [[ ! -f "$JSONL_FILE" ]]; then
  exit 0
fi

# JSONL exists from previous session — score it
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
npx tsx "$SCRIPT_DIR/score-session.ts" 2>&1 || true

exit 0
