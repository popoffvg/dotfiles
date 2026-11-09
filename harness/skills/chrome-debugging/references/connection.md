# Chrome DevTools MCP connection details

## Existing Chrome session

The verified setup used Chrome 156 and `chrome-devtools-mcp` 1.12.0. Auto-connect requires Chrome 144 or newer; check [Google's current instructions](https://developer.chrome.com/docs/devtools/agents/use-cases/auto-connect) before configuring another version.

Open `chrome://inspect/#remote-debugging` in Chrome. The user enables remote debugging and approves the connection prompt. Auto-connect uses the existing profile, including signed-in sessions; a fresh automation browser may need separate sign-ins.

The MCP command used was:

```text
npx --yes chrome-devtools-mcp@latest --autoConnect --no-usage-statistics --no-performance-crux
```

For Codex, a trusted project's `.codex/config.toml` can register:

```toml
[mcp_servers.chrome-devtools]
command = "npx"
args = ["--yes", "chrome-devtools-mcp@latest", "--autoConnect", "--no-usage-statistics", "--no-performance-crux"]
startup_timeout_sec = 60
tool_timeout_sec = 120
```

Resolve an executable path that works in the client's environment; a GUI process may not inherit the interactive shell's PATH. Inspect the existing configuration before editing. Follow the repository's dotfile-management convention. `codex mcp get chrome-devtools` verifies configuration recognition; it does not prove a live browser connection. See [Codex MCP configuration](https://developers.openai.com/codex/mcp/).

## Persistent shell fallback

When native Chrome tools are absent in the current session, a local MCP client can drive the installed server over stdio:

1. Check for an existing bridge first. Reuse it; otherwise start **one** server process, send MCP `initialize`, then `notifications/initialized`.
2. Keep its stdin, stdout and request-ID routing alive for all browser actions. If shell invocations are separate, route them through one persistent local process, such as a bridge on an owner-only Unix socket. Each invocation talks to that process; it does not launch a new browser MCP server.
3. Inspect `tools/list`, then use `tools/call`. Capture complete results privately when they contain credentials; emit a bounded, redacted summary to the agent.

The one-shot pattern—start server, perform one action, terminate—caused repeated Chrome approval prompts in the recorded case.

## Observed pitfalls

- `select_page` does not eliminate per-call `pageId` requirements. For example, `take_snapshot` still required `pageId` in server 1.12.0. The installed tool schema is authoritative.
- File-output tools enforce their configured workspace roots. On macOS, `/tmp` resolves to `/private/tmp`, while the OS temporary directory may be under `/var/folders`. A capture can be denied even though the shell can write it. Capture the MCP response in the client, or use an already-approved server workspace; avoid restarting an approved connection just to change a capture path.
- Canvas terminals do not necessarily expose output in the DOM or accessibility tree. Use a supported file viewer/download or CLI instead of assuming terminal snapshots contain the text.
- Text entry can feed a list editor without committing its value. Verify persistence after the control's confirmation action and a reload.

## Verification

Prove a connection with `list_pages` and inspection of a known target page. A command's `--help`, an MCP initialization response, and a saved config prove different, narrower claims. For authenticated work, verify the target page's signed-in state before making changes. Keep URLs containing authorization codes and snapshots of secret fields out of ordinary output.
