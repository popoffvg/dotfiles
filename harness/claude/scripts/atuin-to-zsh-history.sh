#!/usr/bin/env bash
# Convert atuin history (SQLite) to zsh extended_history format for suv import
# Usage: atuin-to-zsh-history.sh > /tmp/atuin-zsh-history
# Reads directly from atuin's SQLite DB to handle multiline commands correctly.
set -euo pipefail

DB="${ATUIN_DB:-$HOME/.local/share/atuin/history.db}"

if [[ ! -f "$DB" ]]; then
    echo "Error: atuin DB not found at $DB" >&2
    exit 1
fi

# Use python3 to parse JSON from sqlite3 and produce proper zsh extended_history
sqlite3 -json "$DB" \
    "SELECT timestamp, duration, command FROM history WHERE deleted_at IS NULL ORDER BY timestamp ASC" \
| python3 -c '
import json, sys

for row in json.load(sys.stdin):
    epoch = row["timestamp"] // 1_000_000_000
    dur = max(0, row["duration"] // 1_000_000_000)
    cmd = row["command"]
    # Zsh extended_history: multiline commands use trailing backslash
    escaped = cmd.replace("\n", "\\\n")
    print(f": {epoch}:{dur};{escaped}")
'
