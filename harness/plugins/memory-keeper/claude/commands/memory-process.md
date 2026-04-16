---
description: Enqueue unprocessed conversation for daemon processing
---

Extract insights from the current conversation and enqueue them for daemon processing.

1. Call `memory_extract` MCP tool with a summary of the conversation so far
2. Report the result to the user
