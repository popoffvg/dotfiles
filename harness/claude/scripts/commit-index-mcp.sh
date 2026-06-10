#!/usr/bin/env bash
# commit-index-mcp.sh — launch the commit-example search MCP server.
# Wire into ~/.claude.json mcpServers as command: this script (no args).
# Uses the cocoindex-code venv python (has cocoindex + sentence-transformers + mcp).
set -euo pipefail

PY="${COMMIT_INDEX_PY:-$HOME/.local/share/uv/tools/cocoindex-code/bin/python}"
SERVER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/commit-index/server.py"

if [[ ! -x "$PY" ]]; then
  echo "commit-index-mcp: python not found: $PY" >&2; exit 1
fi
exec "$PY" "$SERVER"
