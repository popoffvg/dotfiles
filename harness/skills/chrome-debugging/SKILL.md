---
name: chrome-debugging
description: Control or debug the user's local Chrome through Chrome DevTools MCP, especially when reusing signed-in tabs or preserving a browser-approved connection across multiple actions.
user-invocable: false
---

# Local Chrome debugging

1. **Reuse the connection.** Discover available Chrome DevTools tools and any already-running local MCP transport before launching another. A Chrome connection MUST remain open across the whole browser task; reconnecting for each action can require repeated user approval. Keep the existing browser process, profile, tabs and transport intact. Continue when the same live connection can list pages.

2. **Set up only what is missing.** Check the installed Chrome version and configured MCP server. Read [connection details](references/connection.md) when configuration, remote-debugging permission, or a shell fallback is needed. Missing native tools may require a new agent session; an existing persistent shell transport can finish authorized work in the current session. The user enables Chrome remote debugging and grants the browser's connection prompt. Treat this as required input rather than repeatedly restarting while waiting. Continue when a page inspection succeeds through the approved connection.

3. **Inspect the actual tools and page.** Read the installed tool schemas before acting. List pages, select the intended origin, and take a fresh snapshot for element references. A page ID MUST be resolved within the current connection; IDs can change on reconnect. A tool call MUST supply the fields required by that server version, including `pageId` where required. Continue when the intended tab and target control are observed.

4. **Act, then verify the result.** Use the native click/fill/navigation tools. For a reported bug, reproduce the failing action and inspect the relevant console errors, network requests, or rendered state; verify the same action after a fix. Use a performance trace when diagnosing latency. Use page JavaScript for a targeted inspection or awkward control when it makes the operation reliable. Save credential-bearing results privately and return only the needed status. A successful click MUST be followed by evidence of the intended state change; allow asynchronous navigation/rendering to finish before interpreting the next snapshot.

5. **Leave the session usable.** Verify the requested browser outcome, clean up temporary credential captures and task-specific callback servers, and report any remaining sign-in or permission step accurately. Reconnect, stop the transport, or restart Chrome only when required by an observed failure or explicitly requested by the user.
