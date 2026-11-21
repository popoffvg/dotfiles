---
name: mized-mcp.sh
description: Run the miZed MCP bridge from the fork checkout, as an MCP stdio server with no arguments or as a one-shot `list` or `call <tool> [json|-]` CLI.
args: "[list | call <tool> [json|-]]"
env: "ZED_FORK_DIR (default ~/Documents/git/zed), MIZED_MCP_ADDRESS_FILE (default ~/.mized-mcp-address)"
needs: "`cargo build --release -p mized_mcp --bin mized-mcp` in the fork; miZed started with MIZED_MCP_ADDRESS_FILE set (macos/com.vitalii.mized-mcp-env.plist)"
used_by: agent-to-user skill; the `mized` MCP server in the Claude and Codex configs
---
