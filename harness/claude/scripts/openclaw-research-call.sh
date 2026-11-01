#!/usr/bin/env bash
# Call one vault-mcp research tool on the openclaw server and print the reply text.
# Usage: openclaw-research-call.sh <tool> '<arguments-json>'
#   openclaw-research-call.sh research_start '{"question":"...","repo":"owner/name"}'
#   openclaw-research-call.sh research_continue '{"research":"r1234abcd","questions":["..."]}'
# The token comes from VAULT_MCP_TOKEN_FILE on the server; the token in config.env can be stale.
set -euo pipefail
tool="${1:?usage: openclaw-research-call.sh <tool> '<arguments-json>'}"
args="${2:-{\}}"
body=$(jq -cn --arg tool "$tool" --argjson args "$args" \
  '{jsonrpc:"2.0",id:1,method:"tools/call",params:{name:$tool,arguments:$args}}')
ssh -o ConnectTimeout=10 openclaw 'set -a; . ~/.config/vault-mcp/config.env; set +a
T=$(tr -d "[:space:]" < "$VAULT_MCP_TOKEN_FILE")
curl -s -X POST http://127.0.0.1:8090/mcp -H "Authorization: Bearer $T" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d @-' <<<"$body" \
  | sed -n 's/^data: //p' | jq -r '.result.content[0].text // .error.message // .'
