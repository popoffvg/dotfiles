---
name: vault-mcp
description: Read, search, or create a note in the operator's Z-Core vault through the vault MCP server at mcp.vpopov.dev, and repair its bearer token, which lives in the macOS Keychain item VAULT_MCP_TOKEN. Use for "add to vault", "save this note to the vault", "search my vault", when the `mcp__vault__*` tools are missing or the vault server fails with HTTP 401, or when a script needs the vault token.
---

# vault-mcp — use the vault server, token from Keychain

**The token lives only in Keychain item `VAULT_MCP_TOKEN` (account `$USER`). Never write it into `~/.claude.json`, a script, a note, or chat.** `~/.claude.json` reads it at connect time through `mcpServers.vault.headersHelper: ~/.claude/scripts/mcp-keychain-headers.sh VAULT_MCP_TOKEN`.

## Create a note

1. **Search first** — `search_notes` with the note's title words. Also check `list_notes`: the search index lags by up to 15 minutes. A hit means the note exists: give the operator its path and stop. The server has no edit tool, and `add_note` would make a copy.
2. **Add** — `add_note` with one argument, `text`: the full Markdown. Send no frontmatter: the server picks type, folder, and topics. Done when the reply returns an `_attic/` path; the sorted note shows in `list_notes` after the server bot runs.

Use the `mcp__vault__*` tools. When they are missing, call any vault tool from the shell with the same name and arguments:

```sh
V=https://mcp.vpopov.dev/mcp; C=~/.claude/scripts/mcp-http-call.sh
$C --keychain VAULT_MCP_TOKEN $V tools/call '{"name":"search_notes","arguments":{"query":"pstack"}}'
$C --keychain VAULT_MCP_TOKEN $V tools/call "$(jq -n --rawfile t note.md '{name:"add_note",arguments:{text:$t}}')"
```

An empty reply from the shell call means a 401: go to **Repair a 401**.

Writing straight into `~/obsidian/Z-Core` also syncs to the server, but then the file MUST carry the frontmatter `~/obsidian/Z-Core/CLAUDE.md` defines.

## Repair a 401

1. **Check the token** — this prints only the HTTP code. `200` means the token is good, and only step 3 is left. `401` means the token is wrong, so go to step 2:
   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://mcp.vpopov.dev/mcp \
     -H "Authorization: $(~/.claude/scripts/mcp-keychain-headers.sh VAULT_MCP_TOKEN | jq -r .Authorization)" \
     -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"check","version":"1"}}}'
   ```
2. **Ask the operator for a new token.** The token comes from the vault service on the production host, which the agent MUST NOT read. The operator stores it in a terminal outside Claude Code. A `!` command has no keyboard input, so its prompt stores an empty value:
   ```sh
   security add-generic-password -a "$USER" -s VAULT_MCP_TOKEN -U -w
   ```
   Run step 1 again; continue only on `200`.
3. **Reconnect** — the operator runs `/mcp` → `vault`. A running session keeps the old failure until then. Done when the `mcp__vault__*` tools load.
