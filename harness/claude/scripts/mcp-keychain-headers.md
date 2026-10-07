---
name: mcp-keychain-headers.sh
description: Print the Authorization header of an HTTP MCP server as JSON, with the bearer token read from the macOS Keychain, for use as the server's headersHelper.
args: "<keychain-service>"
needs: security (macOS)
used_by: ~/.claude.json mcpServers.vault.headersHelper, mcp-http-call.sh --keychain, vault-mcp skill
---
