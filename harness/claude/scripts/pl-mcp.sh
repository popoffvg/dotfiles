#!/usr/bin/env bash
# Call the Platforma desktop MCP endpoint over plain HTTP JSON-RPC.
# Usage: pl-mcp.sh <method> [json-params]
#   pl-mcp.sh tools/list
#   pl-mcp.sh tools/call '{"name":"list_projects","arguments":{}}'
set -euo pipefail
URL="${PL_MCP_URL:-$(python3 - <<'PY'
import json,glob,os
for p in [os.path.expanduser("~/git/mil/tasks/MILAB-6679-developability-designer/.mcp.json")]:
    if os.path.exists(p):
        print(json.load(open(p))["mcpServers"]["pl"]["url"]); break
PY
)}"
METHOD="$1"; PARAMS="${2:-{\}}"
HDRS=(-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream')
SID=$(curl -sS -D - -o /dev/null "${HDRS[@]}" -X POST "$URL" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"cli","version":"1"}}}' \
  | tr -d '\r' | awk -F': ' 'tolower($1)=="mcp-session-id"{print $2}')
[ -n "$SID" ] && HDRS+=(-H "Mcp-Session-Id: $SID")
curl -sS "${HDRS[@]}" -X POST "$URL" -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null || true
curl -sS "${HDRS[@]}" -X POST "$URL" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"$METHOD\",\"params\":$PARAMS}" \
  | sed -n 's/^data: //p;/^{/p' | tail -n +1
