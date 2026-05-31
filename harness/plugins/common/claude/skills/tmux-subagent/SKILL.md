---
name: tmux-subagent
description: This skill should be used when the user asks to "launch a subagent in tmux", "run claude in a new pane", "open agent in tmux", "parallel agents in tmux", "tmux pane for claude", or wants to spawn Claude Code instances in separate tmux panes/windows for parallel work.
argument-hint: [task description or number of agents]
---

# Tmux Subagent Launcher

Launch Claude Code subagent instances in separate tmux panes for parallel, visible work. Each agent runs in its own pane with full terminal output, unlike background `Agent` tool calls which hide intermediate work.

## When to Use

- Multiple independent tasks that benefit from visual monitoring
- Long-running agents where the user wants to watch progress
- Tasks requiring different working directories simultaneously
- Parallel research/implementation that should remain inspectable

## Prerequisites

Verify inside a tmux session before launching:

```bash
# Returns something like /dev/ttys001 if inside tmux, empty otherwise
echo "$TMUX"
```

If not inside tmux, fall back to the standard `Agent` tool.

## Modes

**Interactive** (default) — user can chat with the agent, approve tools, steer:
```bash
tmux split-window -h -c "<workdir>" 'claude "<prompt>"'
```

**Non-interactive** (`-p`) — fire-and-forget, agent prints result and exits:
```bash
tmux split-window -h -c "<workdir>" \
  'claude -p --dangerously-skip-permissions "<prompt>"'
```

**Default to interactive** unless the user explicitly asks for fire-and-forget.

## Core Commands

### Horizontal split (side-by-side)

```bash
tmux split-window -h -c "<workdir>" 'claude "<prompt>"'
```

### Vertical split (stacked)

```bash
tmux split-window -v -c "<workdir>" 'claude "<prompt>"'
```

### New window

```bash
tmux new-window -n "agent: <task-label>" -c "<workdir>" 'claude "<prompt>"'
```

### Popup (tmux 3.3+)

```bash
tmux display-popup -w 80% -h 80% -d "<workdir>" -E 'claude "<prompt>"'
```

## Workflow

### 1. Decompose the task

Break work into independent subtasks. Each subtask becomes one pane.

### 2. Choose pane strategy

| Agents | Strategy | Command |
|--------|----------|---------|
| 1 | Popup or split | `display-popup` or `split-window` |
| 2-3 | Directional splits | `split-window -h` / `split-window -v` |
| 4+ | Separate windows | `new-window` |

### 3. Construct prompts

Each agent prompt must be **self-contained** — include all context the agent needs:
- Working directory and relevant file paths
- Specific instructions (not "continue from where I left off")
- Output expectations (file to create, test to pass, etc.)
- Constraints (`--allowedTools` to restrict tool access if needed)

### 4. Launch agents

Run all `tmux` commands. Panes stay open after the agent exits so you can review output. Use `tmux kill-pane` to clean up.

### 5. Collect results

After agents finish, read their output files or check git status for changes.

## Claude CLI Flags Reference

| Flag | Purpose |
|------|---------|
| `-p` / `--print` | Non-interactive mode, print and exit |
| `--dangerously-skip-permissions` | Skip permission prompts (use in trusted dirs only) |
| `--allowedTools "Tool1 Tool2"` | Restrict available tools |
| `--model sonnet` | Use a faster/cheaper model for simple tasks |
| `--max-budget-usd 0.50` | Cap spending per agent |
| `--output-format json` | Structured output for programmatic consumption |
| `--json-schema '{...}'` | Enforce output schema |
| `-w` / `--worktree` | Isolate agent in a git worktree |

## Patterns

### Parallel research agents

```bash
for topic in "auth flow" "database schema" "API endpoints"; do
  tmux split-window -v -c "$(pwd)" \
    "claude -p \"Analyze the $topic in this codebase. Write summary to /tmp/research-${topic// /-}.md\""
done
tmux select-layout tiled  # evenly distribute panes
```

### Implementation + test split

```bash
# Left pane: implement
tmux split-window -h -c "$(pwd)" \
  'claude -p --dangerously-skip-permissions "Implement feature X in src/handler.go"'

# Right pane: write tests (launch manually after impl finishes)
# Prepare the command in a pane, user presses Enter when ready:
tmux split-window -h -c "$(pwd)" \
  'read -p "Press Enter to start test agent..." && claude -p --dangerously-skip-permissions "Write tests for feature X in src/handler_test.go"'
```

### Worktree-isolated agents

```bash
tmux new-window -n "agent: refactor" -c "$(pwd)" \
  'claude -p -w "refactor-branch" --dangerously-skip-permissions "Refactor the auth module to use interfaces"'
```

Each agent gets its own git worktree — no conflicts between parallel changes.

### Send to specific tmux target

```bash
# Create a named window, then send command to it
tmux new-window -n "research"
tmux send-keys -t "research" \
  'claude -p "Summarize the authentication module"' Enter
```

## Error Handling

- **Not in tmux**: Check `$TMUX` first. If empty, use standard `Agent` tool or suggest the user starts tmux.
- **Too many panes**: Use `tmux select-layout tiled` to redistribute, or switch to `new-window` strategy.
- **Agent fails**: Pane stays open with error output. Review, then `tmux kill-pane` to clean up.
