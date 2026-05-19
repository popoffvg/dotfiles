#!/usr/bin/env bash
# Launch `ccc mcp` (stdio MCP server) with cwd set to the given project root.
# Used by Claude Code MCP server registrations because `claude mcp add`
# has no --cwd flag, but ccc picks up the project from cwd.
#
# Usage: ccc-mcp.sh <project-root>
# Example: ccc-mcp.sh /Users/popoffvg/Documents/git/mil/pl

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $(basename "$0") <project-root>" >&2
  exit 2
fi

ROOT="$1"
if [[ ! -d "$ROOT" ]]; then
  echo "project root not found: $ROOT" >&2
  exit 1
fi

cd "$ROOT"
exec ccc mcp
