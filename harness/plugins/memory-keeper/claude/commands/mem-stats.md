---
name: mem-stats
description: Show memory-keeper stats report and queue counts
---

1. Call `memory_stats` MCP tool.
2. Show the returned report verbatim.
3. If tool returns an error or unavailable result, call `memory_queue_stats` MCP tool and show that output.
4. If both fail, tell the user to verify memory-keeper MCP is connected (`memory-keeper-queue` in `.mcp.json`).
