#!/usr/bin/env bash
# Print MCP HTTP headers as JSON with a bearer token from the macOS Keychain.
# Usage: mcp-keychain-headers.sh <keychain-service>
# Claude Code runs it as an MCP server `headersHelper`; stdout MUST be one JSON object.
set -euo pipefail
SERVICE="${1:?usage: mcp-keychain-headers.sh <keychain-service>}"
TOKEN=$(security find-generic-password -s "$SERVICE" -a "$USER" -w 2>/dev/null) || {
  echo "mcp-keychain-headers: no keychain item for service $SERVICE, account $USER" >&2
  exit 1
}
[ -n "$TOKEN" ] || { echo "mcp-keychain-headers: empty keychain item for service $SERVICE" >&2; exit 1; }
printf '{"Authorization":"Bearer %s"}\n' "$TOKEN"
