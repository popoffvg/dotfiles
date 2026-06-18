---
name: work-cmux
description: Orchestrate work/wm planner and implementer as interactive Claude agents in separate cmux panes. Use when user says "start work", "work start" and CMUX_SURFACE_ID is set. Provides 3-pane layout where user controls both agents via cmux.
argument-hint: <work-id or task description>
---

# WM — cmux Pane Orchestration

Run planner and implementer as **separate interactive Claude agents** in cmux panes.

## Source of truth + compatibility (read first)

- **Command flow source of truth:** Claude command behavior (especially `work-next`) is canonical.
- **MCP scope:** MCP tools expose low-level primitives (`work_state`, `work_context`, `work_transition`, `work_abandon`, optional `work_handoff`).
- **Not an MCP tool:** `work-next` is a command/orchestration flow, not a required MCP primitive.
- **Plugin naming:** repos may use `work` (new) or `wm` (legacy). Detect installed plugin/command set first; do not hardcode one name.
- **Transition invariant:** after `todo-done`, do **not** auto-route to `plan-verify`. Route to `verify` (or remain in `implement` until user confirms) based on current command contract.

## Terms

- **Agent** — a role assigned to a cmux pane (planner, implementer, control)
- **Harness** — the agent ecosystem (Claude Code, Pi, or any other host)

## Layout

```
┌──────────────┬──────────────┬──────────────┐
│  CONTROL     │  PLANNER     │  IMPLEMENTER │
│  (you)       │  (persistent)│  (per-TODO)  │
│              │              │              │
│  approve     │  owns plan   │  codes one   │
│  observe     │  transitions │  TODO, then  │
│  intervene   │  phases      │  gets killed │
└──────────────┴──────────────┴──────────────┘
```

## Prerequisites

```bash
[ -n "$CMUX_SURFACE_ID" ] || echo "Not in cmux — skill not applicable"
```

## Signal protocol (MCP-based)

All pane agents use `work_handoff` MCP tool to communicate. Signals are written to `/tmp/work-cmux-signals.json` and relayed via `cmux send` to the target pane.

| From | Action | Target | Meaning |
|------|--------|--------|---------|
| planner | `plan-ready` | control | Plan complete, ready for implement |
| planner | `answer` | implementer | Answer to implementer's question |
| planner | `all-done` | control | All TODOs verified |
| implementer | `todo-done` | control | Finished current TODO (must not auto-trigger `plan-verify`) |
| implementer | `question` | planner | Needs clarification |
| implementer | `blocked` | control | Stuck, needs user help |
| control | `answer` | implementer | User answers directly |

## Phase 1: Register surfaces

Before launching agents, write the control pane surface:

```bash
echo "CONTROL=$CMUX_SURFACE_ID" > /tmp/work-cmux-surfaces
```

## Phase 2: Launch planner

```bash
if [ -d "$HOME/Documents/git/dotfiles/harness/plugins/work/claude" ]; then
  PLUGIN_DIR="$HOME/Documents/git/dotfiles/harness/plugins/work/claude"
else
  PLUGIN_DIR="$HOME/Documents/git/dotfiles/harness/plugins/work-manager/claude"
fi

# Create planner pane
OUTPUT=$(cmux new-pane --type terminal --direction right --cwd "$(pwd)")
PLANNER_SURFACE=$(echo "$OUTPUT" | grep -o 'surface:[0-9]*')

# Register surface
echo "PLANNER=$PLANNER_SURFACE" >> /tmp/work-cmux-surfaces

# Launch Claude with active work plugin
cmux send --surface "$PLANNER_SURFACE" "claude --dangerously-skip-permissions --plugin-dir $PLUGIN_DIR"
cmux send-key --surface "$PLANNER_SURFACE" enter
```

Wait ~10s, then send role assignment:

```bash
cmux send --surface "$PLANNER_SURFACE" "You are the PLANNER agent running in a cmux pane. Your role:
1. Read .notes/spec.md and own the plan
2. Use work_transition according to current command contract (do not force plan-verify if flow says otherwise)
3. When plan is ready, call work_handoff(from: 'planner', action: 'plan-ready', message: '<summary>')
4. When implementer asks a question, answer via work_handoff(from: 'planner', action: 'answer', target: 'implementer', message: '<answer>')
5. NEVER write code outside .notes/

Start by calling work_context to see current state."
cmux send-key --surface "$PLANNER_SURFACE" enter
```

## Phase 3: Launch implementer (per TODO)

```bash
OUTPUT=$(cmux new-pane --type terminal --direction right --cwd "$(pwd)")
IMPL_SURFACE=$(echo "$OUTPUT" | grep -o 'surface:[0-9]*')

# Update surface registry
sed -i '' '/^IMPL=/d' /tmp/work-cmux-surfaces
echo "IMPL=$IMPL_SURFACE" >> /tmp/work-cmux-surfaces

# Launch Claude with active work plugin + sonnet model
cmux send --surface "$IMPL_SURFACE" "claude --dangerously-skip-permissions --model sonnet --plugin-dir $PLUGIN_DIR"
cmux send-key --surface "$IMPL_SURFACE" enter
```

Wait ~10s, then send the TODO:

```bash
TODO_TEXT="<extracted from spec.md>"
cmux send --surface "$IMPL_SURFACE" "You are the IMPLEMENTER agent for this TODO:

$TODO_TEXT

Rules:
- Implement ONLY this TODO, nothing else
- When done: call work_handoff(from: 'implementer', action: 'todo-done', message: '<summary>')
- If you need clarification: call work_handoff(from: 'implementer', action: 'question', target: 'planner', message: '<question>') and WAIT for answer
- If blocked: call work_handoff(from: 'implementer', action: 'blocked', message: '<problem>')
- Do NOT modify .notes/spec.md"
cmux send-key --surface "$IMPL_SURFACE" enter
```

## Phase 4: Monitor signals

The control pane watches for signals:

```bash
# Read latest signals
cat /tmp/work-cmux-signals.json | jq '.[-1]'

# Or poll for a specific action
cat /tmp/work-cmux-signals.json | jq '[.[] | select(.action == "todo-done")] | last'
```

Signals also arrive via `cmux send` to the control pane — they appear as messages prefixed with `[PLANNER→CONTROL]` or `[IMPLEMENTER→CONTROL]`.

## Phase 5: Rotate implementer

After user approves a completed TODO:

```bash
# 1. Close old implementer
cmux send --surface "$IMPL_SURFACE" "/exit"
cmux send-key --surface "$IMPL_SURFACE" enter
sleep 2
cmux close-surface --surface "$IMPL_SURFACE"

# 2. Mark TODO done in spec.md (from control pane)
# Edit .notes/spec.md: [ ] → [x]

# 3. Launch fresh implementer for next TODO (repeat Phase 3)
```

Fresh pane = fresh context = better focus per TODO.

## Phase 6: Completion

When planner sends `all-done`:

```bash
# Close implementer (if still open)
cmux close-surface --surface "$IMPL_SURFACE" 2>/dev/null

# Tell planner to verify and summarize
cmux send --surface "$PLANNER_SURFACE" "All TODOs done. Call work_transition(to: 'verify') and summarize results."
cmux send-key --surface "$PLANNER_SURFACE" enter

# After verification, close planner
cmux close-surface --surface "$PLANNER_SURFACE"

# Clean up
rm -f /tmp/work-cmux-surfaces /tmp/work-cmux-signals.json
```

## MCP tools available to all panes

Each pane agent loads the active work plugin and has access to:

| Tool | Purpose | Used by |
|------|---------|---------|
| `work_state` | Read/update `.pi/work.settings.json` | all |
| `work_context` | Get plan, worklog, phase instructions | all |
| `work_transition` | Change phases | planner, control |
| `work_handoff` | Signal between panes | planner, implementer |

| `work_abandon` | Cancel everything | control |

## Error handling

| Problem | Fix |
|---------|-----|
| Surface not found | `cmux tree` to list active surfaces |
| Agent not responding | `cmux read-screen --surface $SURFACE --scrollback` |
| Pane closed unexpectedly | Relaunch, agent has no state to recover |
| Signal not received | Check `/tmp/work-cmux-signals.json` directly |
| Wrong directory | Always `--cwd "$(pwd)"` when creating panes |
