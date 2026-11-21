---
name: open-canvas
description: >-
  Use when the user asks to run utpalsinghdev Open Canvas in Docker, troubleshoot its local editor, or connect an MCP client to its workspaces.
---

# Open Canvas

1. For Docker, list available engines with `docker context ls`. Confirm the intended engine responds with `docker --context <context> version`. Use that context for each Docker command.
2. For installation, follow [the Docker setup](references/docker.md). Before a runtime change, record the exact browser origin and workspace storage path. After the change, confirm the workspace chooser loads at that origin.
3. For native MCP, generate the client entry with `open-canvas mcp-config`. For the reference image, use `docker --context <context> exec -i <container> /opt/open-canvas/bin/open-canvas mcp` as the stdio command. Verify access with `get_capabilities` and `list_workspaces`. Target saved documents by `workspaceId`. For browser rendering, open the workspace and use its connected `canvasId`. [Upstream MCP instructions](https://github.com/utpalsinghdev/open-canvas/blob/main/docs/mcp.md)
