#!/usr/bin/env bash
# Stop hook — run session scoring script.
# Processes JSONL events, computes scores, persists to stats files.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
npx tsx "$SCRIPT_DIR/score-session.ts" 2>&1 || true

exit 0
