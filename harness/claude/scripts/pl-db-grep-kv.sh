#!/usr/bin/env bash
# Scan RocksDB SST/WAL files for a pattern and extract nearby resource IDs (NG:0x...).
# Usage: pl-db-grep-kv.sh <db-dir> <pattern>
#
# Example:
#   pl-db-grep-kv.sh /tmp/db "03h/4xy/365/03h4xy..."

set -euo pipefail

DB_DIR="${1:?Usage: pl-db-grep-kv.sh <db-dir> <pattern>}"
PATTERN="${2:?Usage: pl-db-grep-kv.sh <db-dir> <pattern>}"

if [[ ! -d "$DB_DIR" ]]; then
  echo "Error: $DB_DIR is not a directory" >&2
  exit 1
fi

for f in "$DB_DIR"/*.sst "$DB_DIR"/*.log; do
  [[ -f "$f" ]] || continue
  strings "$f" 2>/dev/null \
    | grep -B 10 -F "$PATTERN" \
    | grep -oE 'NG:0x[0-9A-Fa-f]+'
done | sort -u
