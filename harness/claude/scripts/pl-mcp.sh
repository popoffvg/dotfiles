#!/usr/bin/env bash
# Call a Platforma desktop MCP tool. Usage: pl-mcp.sh <tool> [json-args]
set -euo pipefail
U="${PL_MCP_URL:?set PL_MCP_URL}"
TOOL="${1:?tool name}"; ARGS="${2:-{}}"
hdr=(-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream')
init=$(curl -sS -D- -m 30 -X POST "$U" "${hdr[@]}" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"cc","version":"0"}}}')
SID=$(printf '%s' "$init" | grep -i '^mcp-session-id:' | awk '{print $2}' | tr -d '\r')
curl -sS -m 30 -X POST "$U" "${hdr[@]}" -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null
curl -sS -m 600 -X POST "$U" "${hdr[@]}" -H "mcp-session-id: $SID" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"$TOOL\",\"arguments\":$ARGS}}" \
| python3 -c '
import sys,json
for line in sys.stdin:
    line=line.strip()
    if not line.startswith("data:"): continue
    try: d=json.loads(line[5:].strip())
    except: continue
    if "error" in d: print("ERROR:",json.dumps(d["error"],indent=2)); sys.exit(1)
    if "result" in d:
        for c in d["result"].get("content",[]): print(c.get("text", json.dumps(c)))
'
