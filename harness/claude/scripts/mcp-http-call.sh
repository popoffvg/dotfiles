#!/usr/bin/env bash
# Call one method on a streamable-HTTP MCP server, handling the initialize
# handshake and the mcp-session-id header the server hands back.
#
# Usage: mcp-http-call.sh <url> <method> [params-json]
#   mcp-http-call.sh "$URL" tools/list
#   mcp-http-call.sh "$URL" tools/call '{"name":"list_projects","arguments":{}}'
set -euo pipefail

url=${1:?url required}
method=${2:?method required}
params=${3:-'{}'}
proto=2025-06-18
accept='application/json, text/event-stream'

hdr=$(mktemp)
trap 'rm -f "$hdr"' EXIT

curl -s -D "$hdr" -o /dev/null -X POST "$url" \
  -H 'Content-Type: application/json' -H "Accept: $accept" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"$proto\",\"capabilities\":{},\"clientInfo\":{\"name\":\"mcp-http-call\",\"version\":\"1\"}}}"

session=$(awk 'BEGIN{IGNORECASE=1}/^mcp-session-id:/{print $2}' "$hdr" | tr -d '\r')
auth=()
[ -n "$session" ] && auth=(-H "mcp-session-id: $session")

curl -s -X POST "$url" -H 'Content-Type: application/json' -H "Accept: $accept" "${auth[@]}" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null

curl -s -X POST "$url" -H 'Content-Type: application/json' -H "Accept: $accept" "${auth[@]}" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"$method\",\"params\":$params}" \
  | sed -n 's/^data: //p'
