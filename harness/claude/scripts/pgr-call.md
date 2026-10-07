---
name: pgr-call.sh
description: Call one tool of the pgr code-search MCP server (ripgrep ranked for agents — definitions before references, source before tests) from Bash, rooted at any repo.
args: "[-C DIR] <tool> ['<json arguments>']"
needs: pgr (cargo install --git https://github.com/entireio/pgr), rg, jq
used_by: wm explorer agent
---
