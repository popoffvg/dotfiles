# Test Harness Plugin

Run harness plugin tests in tmux panes for visible, parallel feedback.

## Plugin layout

```
harness/plugins/<name>/
├── common/           # Shared: types, FSM, server, skills
│   ├── server/       # MCP server (stdio) — has its own package.json
│   └── *.ts          # Pure logic (unit-testable)
├── claude/           # Claude Code plugin
│   ├── .claude-plugin/plugin.json
│   └── ...
├── pi/               # Pi agent extension
│   └── index.ts
└── __tests__/        # Unit tests (node:test + tsx)
```

## Test layers

| Layer | What | How | Pane |
|-------|------|-----|------|
| **typecheck** | TS types compile | `npx tsc --noEmit` in each `package.json` dir | 1 |
| **unit** | Pure logic | `npx tsx --test __tests__/*.test.ts` or `node --test --loader tsx` | 1 |
| **MCP server** | Server starts, tools register | Spawn server via stdio, call `tools/list` | 2 |
| **Claude plugin** | Full plugin loads in Claude | `claude --plugin-dir <path> -p "list your MCP tools"` | 3 |

## Workflow

### 1. Resolve plugin path

```bash
PLUGIN="<name>"
PLUGIN_DIR="$HOME/Documents/git/dotfiles/harness/plugins/$PLUGIN"
```

Verify it exists: `ls "$PLUGIN_DIR"`.

### 2. Typecheck (fast, run first)

Check each subdir that has a `tsconfig.json`:

```bash
for dir in "$PLUGIN_DIR/common/server" "$PLUGIN_DIR/claude" "$PLUGIN_DIR/pi"; do
  [ -f "$dir/tsconfig.json" ] && (cd "$dir" && npx tsc --noEmit) && echo "OK: $dir" || echo "FAIL: $dir"
done
```

### 3. Unit tests

```bash
# If __tests__/ exists
if [ -d "$PLUGIN_DIR/__tests__" ]; then
  cd "$PLUGIN_DIR" && npx tsx --test __tests__/*.test.ts
fi

# If pi/tests/ exists
if [ -d "$PLUGIN_DIR/pi/tests" ]; then
  cd "$PLUGIN_DIR/pi" && npx tsx --test tests/*.test.ts
fi
```

### 4. MCP server smoke test

For plugins with `common/server/index.ts`:

```bash
SERVER_DIR="$PLUGIN_DIR/common/server"
if [ -f "$SERVER_DIR/index.ts" ]; then
  # Install deps if needed
  [ -d "$SERVER_DIR/node_modules" ] || (cd "$SERVER_DIR" && npm install)

  # Start server and send initialize + tools/list via stdio
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}' | \
    timeout 10 npx tsx "$SERVER_DIR/index.ts" 2>/dev/null | head -5
fi
```

Expected: JSON response with server capabilities and tool list.

### 5. Claude plugin load test (tmux pane)

This requires a separate tmux pane since Claude is interactive:

```bash
# In a new tmux pane:
tmux split-window -h -c "$PLUGIN_DIR"
tmux send-keys 'claude --plugin-dir ./claude -p "List all MCP tools available to you. For each tool, show the name and parameters."' Enter
```

Or with cmux (if available):

```bash
OUTPUT=$(cmux new-pane --type terminal --direction right --cwd "$PLUGIN_DIR")
SURFACE=$(echo "$OUTPUT" | grep -o 'surface:[0-9]*')
cmux send --surface "$SURFACE" "claude --plugin-dir ./claude -p 'List all MCP tools available to you. For each tool, show the name and parameters.'"
cmux send-key --surface "$SURFACE" enter
# Read result after ~15s
sleep 15 && cmux read-screen --surface "$SURFACE"
```

### 6. Parallel test run (all layers)

Use tmux to run typecheck + unit + MCP in parallel panes:

```bash
SESSION="test-$PLUGIN"
tmux new-session -d -s "$SESSION" -c "$PLUGIN_DIR"

# Pane 0: typecheck + unit
tmux send-keys "echo '=== TYPECHECK ===' && (cd common/server && npx tsc --noEmit) && echo '=== UNIT TESTS ===' && npx tsx --test __tests__/*.test.ts 2>/dev/null; echo '--- DONE ---'" Enter

# Pane 1: MCP server test
tmux split-window -h -c "$PLUGIN_DIR"
tmux send-keys 'echo "=== MCP SERVER ===" && echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"0.1\"}}}" | timeout 10 npx tsx common/server/index.ts 2>/dev/null | head -5; echo "--- DONE ---"' Enter

# Pane 2: Claude plugin load
tmux split-window -v -c "$PLUGIN_DIR"
tmux send-keys 'echo "=== CLAUDE PLUGIN ===" && claude --plugin-dir ./claude -p "List your MCP tools (name + params only)" 2>&1 | tail -20; echo "--- DONE ---"' Enter

# Attach or read
tmux attach -t "$SESSION"
```

## Quick single-layer commands

```bash
# Just typecheck
cd "$PLUGIN_DIR/common/server" && npx tsc --noEmit

# Just unit tests
cd "$PLUGIN_DIR" && npx tsx --test __tests__/*.test.ts

# Just MCP smoke
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}' | npx tsx common/server/index.ts

# Just Claude load
claude --plugin-dir ./claude -p "list MCP tools"
```

## Reading results

After running parallel tests in tmux:

```bash
# Capture each pane's output
tmux capture-pane -t "$SESSION:0.0" -p  # typecheck + unit
tmux capture-pane -t "$SESSION:0.1" -p  # MCP server
tmux capture-pane -t "$SESSION:0.2" -p  # Claude plugin
```

Or with cmux:

```bash
cmux read-screen --surface surface:N
```

Look for `--- DONE ---` markers to know each layer finished.

## Common failures

| Symptom | Fix |
|---------|-----|
| `Cannot find module` | Run `npm install` in the relevant subdir |
| `__dirname is not defined` | Module uses CJS pattern — switch to `fileURLToPath(import.meta.url)` |
| MCP server hangs | Missing `StdioServerTransport` connect, or infinite loop in init |
| Claude can't find plugin | Check `plugin.json` exists in `claude/.claude-plugin/` |
| `PLUGIN_ROOT` wrong | Set env: `PLUGIN_ROOT=$PLUGIN_DIR/claude` before server start |
