#!/usr/bin/env bash
# Usage: pgr-call.sh [-C DIR] <tool> ['<json arguments>']
# Calls one tool of the pgr MCP server over stdio, rooted at DIR (default: $PWD), and prints the tool text.
# Tools: search_code, read_code, find_files, list_dir. Exit 2 = pgr or rg missing, 1 = protocol error.
# pgr returns a bad tool name or argument as plain result text ("Unknown tool: x") with exit 0.
set -euo pipefail
dir=$PWD
if [[ ${1:-} == -C ]]; then dir=$2; shift 2; fi
tool=${1:?usage: pgr-call.sh [-C DIR] <tool> ['<json arguments>']}
args=${2:-'{}'}
pgr=${PGR_BIN:-$(command -v pgr || echo "$HOME/.cargo/bin/pgr")}
[[ -x $pgr ]] || { echo "pgr-call: pgr not found; install: cargo install --git https://github.com/entireio/pgr" >&2; exit 2; }
command -v rg >/dev/null || { echo "pgr-call: rg not found on PATH" >&2; exit 2; }
req=$(jq -cn --arg t "$tool" --argjson a "$args" \
  '{jsonrpc:"2.0",id:2,method:"tools/call",params:{name:$t,arguments:$a}}')
cd "$dir"
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"pgr-call","version":"1"}}}' \
  "$req" \
  | "$pgr" \
  | jq -r 'select(.id==2)
      | if .error then "pgr-call: \(.error.message)\n" | halt_error(1)
        elif .result.isError then "pgr-call: \([.result.content[]?.text] | join(" "))\n" | halt_error(1)
        else .result.content[]?.text end'
