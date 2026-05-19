---
name: cmux-subagent
description: This skill should be used when the user asks to "launch a subagent in cmux", "run claude in a new pane", "open agent in cmux", "parallel agents", "cmux pane for claude", "split pane agent", or wants to spawn Claude Code instances in separate cmux panes for parallel, interactive work with bidirectional communication.
argument-hint: [task description or number of agents]
---

# cmux Subagent Launcher

Launch Claude Code agents in cmux split panes with **bidirectional communication** via Unix socket API. Unlike tmux's fragile screen-scraping, cmux provides typed `send`/`read-screen` commands for reliable inter-agent messaging.

## Prerequisites

Verify inside a cmux session:

```bash
echo "$CMUX_SURFACE_ID"  # non-empty = inside cmux
```

If not inside cmux, fall back to the standard `Agent` tool.

## Quick Reference

| Action | Command |
|--------|---------|
| Create pane | `cmux new-pane --type terminal --direction right --cwd "$(pwd)"` |
| Send text | `cmux send --surface surface:N 'message'` |
| Press Enter | `cmux send-key --surface surface:N enter` |
| Read output | `cmux read-screen --surface surface:N` |
| List panes | `cmux tree` |
| Close pane | `cmux close-surface --surface surface:N` |

## Modes

**Interactive** (default) — long-lived agent, user or orchestrator can chat:
```bash
cmux send --surface surface:N 'claude --dangerously-skip-permissions'
cmux send-key --surface surface:N enter
```

**Non-interactive** (`-p`) — fire-and-forget, prints result and exits:
```bash
cmux send --surface surface:N 'claude -p --dangerously-skip-permissions "<prompt>"'
cmux send-key --surface surface:N enter
```

**Default to interactive** unless the user explicitly asks for fire-and-forget.

## Workflow

### 1. Create a pane (always pass `--cwd`)

```bash
cmux new-pane --type terminal --direction right --cwd "$(pwd)"
# Returns: OK surface:N pane:N workspace:N
# Capture the surface ref (e.g., surface:3)
```

Direction options: `right`, `left`, `up`, `down`.

### 2. Launch agent

```bash
cmux send --surface surface:N 'claude --dangerously-skip-permissions'
cmux send-key --surface surface:N enter
```

Wait ~8s for Claude to initialize, then verify:

```bash
cmux read-screen --surface surface:N
# Look for the "❯" prompt indicating ready
```

### 3. Send messages (fast loop)

```bash
# Send
cmux send --surface surface:N 'your message here'
cmux send-key --surface surface:N enter

# Wait and read — 5s is usually enough for short replies
sleep 5 && cmux read-screen --surface surface:N
```

**Speed tips:**
- First message: wait 8-10s (cold start)
- Subsequent messages: wait 3-5s for short replies, 10-15s for complex tasks
- Poll with `read-screen` — check if the `❯` prompt reappeared (agent is done)

### 4. Detect completion

Parse `read-screen` output for the idle prompt pattern:
```
❯
```
When you see an empty `❯` prompt at the bottom, the agent has finished responding.

### 5. Cleanup

```bash
# Graceful exit
cmux send --surface surface:N '/exit'
cmux send-key --surface surface:N enter

# Or force close
cmux close-surface --surface surface:N
```

## Pane Strategy

| Agents | Strategy | Direction |
|--------|----------|-----------|
| 1 | Single split | `right` |
| 2 | Right + down | `right`, then `down` on second |
| 3+ | Separate per task | Multiple `right`/`down` splits |

## Claude CLI Flags

| Flag | Purpose |
|------|---------|
| `--dangerously-skip-permissions` | Skip permission prompts |
| `-p` / `--print` | Non-interactive, print and exit |
| `--allowedTools "Tool1 Tool2"` | Restrict available tools |
| `--model sonnet` | Faster/cheaper model |
| `--max-budget-usd 0.50` | Cap spending per agent |
| `-w` / `--worktree` | Isolate in git worktree |

## Patterns

### Ping-pong (bidirectional communication)

```bash
# 1. Create pane
cmux new-pane --type terminal --direction right --cwd "$(pwd)"
# → surface:N

# 2. Launch interactive agent
cmux send --surface surface:N 'claude --dangerously-skip-permissions'
cmux send-key --surface surface:N enter
sleep 8

# 3. Send task
cmux send --surface surface:N 'Analyze the main module and list public functions'
cmux send-key --surface surface:N enter
sleep 5

# 4. Read response
cmux read-screen --surface surface:N

# 5. Send follow-up based on response
cmux send --surface surface:N 'Now write tests for the first 3 functions'
cmux send-key --surface surface:N enter
```

### Parallel research agents

```bash
for topic in "auth flow" "database schema" "API endpoints"; do
  OUTPUT=$(cmux new-pane --type terminal --direction right --cwd "$(pwd)")
  SURFACE=$(echo "$OUTPUT" | grep -o 'surface:[0-9]*')
  cmux send --surface "$SURFACE" "claude -p --dangerously-skip-permissions \"Analyze the $topic in this codebase. Write summary to /tmp/research-${topic// /-}.md\""
  cmux send-key --surface "$SURFACE" enter
done
```

### Worktree-isolated agent

```bash
cmux new-pane --type terminal --direction right --cwd "$(pwd)"
# → surface:N
cmux send --surface surface:N 'claude -p -w --dangerously-skip-permissions "Refactor the auth module"'
cmux send-key --surface surface:N enter
```

## Error Handling

- **Not in cmux**: Check `$CMUX_SURFACE_ID`. If empty, fall back to `Agent` tool or tmux skill.
- **Surface not found**: Run `cmux tree` to list valid surfaces.
- **Surface is not a terminal**: You targeted a browser surface. Use `--type terminal` when creating panes.
- **Agent not responding**: Increase wait time. Check `cmux read-screen` for error output.

## Advantages over tmux

| Feature | cmux | tmux |
|---------|------|------|
| Send text | `cmux send` (typed, reliable) | `send-keys` (byte sequence, fragile) |
| Read output | `cmux read-screen` (clean) | `capture-pane` (screen-scrape artifacts) |
| Addressing | Stable `surface:N` refs | Session:window.pane (can shift) |
| Key events | `send-key enter` (explicit) | `send-keys Enter` (string matching) |
| API | Unix socket | tmux server protocol |
