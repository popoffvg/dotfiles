---
name: zellij-subagent
description: This skill should be used when the user asks to "launch a subagent in zellij", "run claude in a new pane", "open agent in zellij", "parallel agents in zellij", "zellij pane for claude", or wants to spawn Claude Code instances in separate Zellij panes/tabs for parallel work.
argument-hint: [task description or number of agents]
---

# Zellij Subagent Launcher

Launch Claude Code subagent instances in separate Zellij panes for parallel, visible work. Each agent runs in its own pane with full terminal output, unlike background `Agent` tool calls which hide intermediate work.

## When to Use

- Multiple independent tasks that benefit from visual monitoring
- Long-running agents where the user wants to watch progress
- Tasks requiring different working directories simultaneously
- Parallel research/implementation that should remain inspectable

## Prerequisites

Verify inside a Zellij session before launching:

```bash
# Returns session name if inside zellij, empty otherwise
echo "$ZELLIJ_SESSION_NAME"
```

If not inside Zellij, fall back to the standard `Agent` tool.

## Core Commands

### Launch agent in a floating pane

```bash
zellij run -f -n "agent: <task-label>" --cwd "<workdir>" -- \
  claude -p --dangerously-skip-permissions "<prompt>"
```

### Launch agent in a directional split

```bash
# Right split (side-by-side)
zellij run -d right -n "agent: <task-label>" --cwd "<workdir>" -- \
  claude -p --dangerously-skip-permissions "<prompt>"

# Down split (stacked)
zellij run -d down -n "agent: <task-label>" --cwd "<workdir>" -- \
  claude -p --dangerously-skip-permissions "<prompt>"
```

### Launch agent in a new tab

```bash
zellij action new-tab -n "agent: <task-label>" --cwd "<workdir>" -- \
  claude -p --dangerously-skip-permissions "<prompt>"
```

### Launch agent in-place (suspends current pane)

```bash
zellij run -i -n "agent: <task-label>" --cwd "<workdir>" -- \
  claude -p --dangerously-skip-permissions "<prompt>"
```

## Workflow

### 1. Decompose the task

Break work into independent subtasks. Each subtask becomes one pane.

### 2. Choose pane strategy

| Agents | Strategy | Flag |
|--------|----------|------|
| 1 | In-place or floating | `-i` or `-f` |
| 2-3 | Directional splits | `-d right` / `-d down` |
| 4+ | Separate tabs or floating | `new-tab` or `-f` |

### 3. Construct prompts

Each agent prompt must be **self-contained** — include all context the agent needs:
- Working directory and relevant file paths
- Specific instructions (not "continue from where I left off")
- Output expectations (file to create, test to pass, etc.)
- Constraints (`--allowedTools` to restrict tool access if needed)

### 4. Launch agents

Run all `zellij run` commands. Use `--close-on-exit` (`-c`) to auto-close panes when done, or omit it to keep output visible for review.

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
# Launch 3 research agents in floating panes
for topic in "auth flow" "database schema" "API endpoints"; do
  zellij run -f -n "research: $topic" -c -- \
    claude -p "Analyze the $topic in this codebase. Output a summary to /tmp/research-${topic// /-}.md"
done
```

### Implementation + review split

```bash
# Left pane: implement
zellij run -d right -n "implement" -- \
  claude -p --dangerously-skip-permissions "Implement feature X in src/handler.go"

# Right pane: write tests (after implementation)
zellij run -d right -n "test" -s -- \
  claude -p --dangerously-skip-permissions "Write tests for feature X in src/handler_test.go"
```

The `-s` (start-suspended) flag on the test agent lets the user trigger it manually after implementation finishes.

### Worktree-isolated agents

```bash
zellij run -f -n "agent: refactor" -c -- \
  claude -p -w "refactor-branch" --dangerously-skip-permissions \
    "Refactor the auth module to use interfaces"
```

Each agent gets its own git worktree — no conflicts between parallel changes.

## Error Handling

- **Not in Zellij**: Check `$ZELLIJ_SESSION_NAME` first. If empty, use standard `Agent` tool or suggest the user starts Zellij.
- **Pane won't open**: Zellij may be at max panes. Use `--max-panes` or close existing panes.
- **Agent fails silently**: Without `-c`, the pane stays open showing the error. Review pane output manually.

## Additional Resources

- **`references/layouts.md`** — Custom Zellij layout templates for multi-agent workflows
