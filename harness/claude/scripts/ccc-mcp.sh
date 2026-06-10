#!/usr/bin/env bash
# Launch `ccc mcp` (stdio MCP server) with cwd set to the resolved project root.
# Used by Claude Code MCP server registrations because `claude mcp add`
# has no --cwd flag, but ccc picks up the project from cwd.
#
# Project resolution order (first match wins):
#   1. $COCOINDEX_PROJECT   — env var, the way to pick a project per shell/session.
#                             Export it before launching `claude`:
#                               export COCOINDEX_PROJECT=/Users/popoffvg/Documents/git/mil/pl
#   2. $1                    — positional arg (the default wired in the MCP config).
#   3. $PWD                  — current dir, so `ccc` walks up to find the project.
#
# A single global MCP entry can therefore serve any indexed project: the env var
# selects it, the arg provides the default when the env var is unset.
#
# Usage: ccc-mcp.sh [default-project-root]

set -euo pipefail

if [[ -n "${COCOINDEX_PROJECT:-}" ]]; then
  ROOT="$COCOINDEX_PROJECT"; SRC="COCOINDEX_PROJECT"
elif [[ -n "${1:-}" ]]; then
  ROOT="$1"; SRC="arg"
else
  ROOT="$PWD"; SRC="PWD"
fi

if [[ ! -d "$ROOT" ]]; then
  echo "ccc-mcp: project root not found: $ROOT" >&2
  exit 1
fi

# Validate it's an initialized ccc project (settings.yml found walking up).
# Mirrors ccc's own find_project_root so failures are clear, not cryptic.
probe="$(cd "$ROOT" && pwd)"
found=""
while :; do
  if [[ -f "$probe/.cocoindex_code/settings.yml" ]]; then
    found="$probe"
    break
  fi
  parent="$(dirname "$probe")"
  [[ "$parent" == "$probe" ]] && break
  probe="$parent"
done

if [[ -z "$found" ]]; then
  echo "ccc-mcp: no initialized ccc project at or above: $ROOT" >&2
  echo "ccc-mcp: run \`ccc init\` then \`ccc index\` there first." >&2
  exit 1
fi

# Trace which project was selected (handy when debugging env-driven selection).
echo "ccc-mcp: serving project $found (source: $SRC)" >&2

cd "$found"
exec ccc mcp
