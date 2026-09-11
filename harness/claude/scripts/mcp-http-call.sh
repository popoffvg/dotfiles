#!/usr/bin/env bash
# Call a streamable-HTTP MCP server with one JSON-RPC request and print the result.
#
# Usage: mcp-http-call.sh <url> <method> [params-json]
#   mcp-http-call.sh "$URL" tools/list
#   mcp-http-call.sh "$URL" tools/call '{"name":"foo","arguments":{"a":1}}'
#
# Performs the initialize handshake first, reuses the returned Mcp-Session-Id,
# and unwraps both plain-JSON and text/event-stream replies.
set -euo pipefail

URL="${1:?usage: mcp-http-call.sh <url> <method> [params-json]}"
METHOD="${2:?usage: mcp-http-call.sh <url> <method> [params-json]}"
PARAMS="${3:-{\}}"

ACCEPT='Accept: application/json, text/event-stream'
CT='Content-Type: application/json'

# Strip SSE framing ("data: " prefixes) so the payload is plain JSON either way.
unwrap() { grep -a '^data: ' | sed 's/^data: //' || cat; }

HDRS="$(mktemp)"
trap 'rm -f "$HDRS"' EXIT

curl -s -D "$HDRS" -H "$ACCEPT" -H "$CT" -X POST "$URL" -d '{
  "jsonrpc":"2.0","id":1,"method":"initialize",
  "params":{"protocolVersion":"2025-06-18","capabilities":{},
            "clientInfo":{"name":"claude-code-probe","version":"1.0"}}}' >/dev/null

SESSION="$(tr -d '\r' < "$HDRS" | awk -F': ' 'tolower($1)=="mcp-session-id"{print $2}')"
SESSION_HDR=()
[ -n "$SESSION" ] && SESSION_HDR=(-H "Mcp-Session-Id: $SESSION")

curl -s -H "$ACCEPT" -H "$CT" "${SESSION_HDR[@]}" -X POST "$URL" -d '{
  "jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null || true

curl -s -H "$ACCEPT" -H "$CT" "${SESSION_HDR[@]}" -X POST "$URL" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"$METHOD\",\"params\":$PARAMS}" \
  | { out="$(cat)"; printf '%s' "$out" | grep -qa '^data: ' \
      && printf '%s' "$out" | unwrap || printf '%s' "$out"; }
