#!/usr/bin/env bash
# Call a streamable-HTTP MCP server from the shell.
# Usage: mcp-http.sh <base-url> <method> [json-params]
# Does the initialize handshake, reuses the returned Mcp-Session-Id, then makes the call.
set -euo pipefail
URL="$1"; METHOD="$2"; PARAMS="${3:-{\}}"
H=$(mktemp)
curl -s -D "$H" -o /dev/null -m 15 -X POST "$URL" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"claude-code-shell","version":"1"}}}'
SID=$(awk 'BEGIN{IGNORECASE=1}/^mcp-session-id:/{gsub(/\r/,"");print $2}' "$H")
AUTH=(-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream')
[ -n "$SID" ] && AUTH+=(-H "Mcp-Session-Id: $SID")
curl -s -m 15 -X POST "$URL" "${AUTH[@]}" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null || true
curl -s -m 60 -X POST "$URL" "${AUTH[@]}" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"$METHOD\",\"params\":$PARAMS}" \
  | sed -e 's/^data: //' | grep -v '^event:' | grep -v '^$'
rm -f "$H"
