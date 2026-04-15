---
name: work-cmux
description: >
  Orchestrate work-manager planner and implementer as interactive Claude agents
  in separate cmux panes. Use when user says "start work", "work start" and
  CMUX_SURFACE_ID is set. Provides 3-pane layout where user controls both agents via cmux.
---

# work-cmux: 3-pane cmux orchestration

When `$CMUX_SURFACE_ID` is set, work-manager uses cmux panes instead of Agent subprocesses.

## Pane layout

| Pane | Role | Lifecycle |
|------|------|-----------|
| **Control** (you) | Router — relay messages, approve TODOs, manage surfaces | Persistent |
| **Planner** | Interactive Claude for plan phase | Persistent during plan |
| **Implementer** | Interactive Claude for one TODO | Ephemeral — one per TODO |

## Working directory rule

All panes MUST work in the **current directory** (`$PWD`). Pass `--cwd "$PWD"` when creating panes. Do not switch directories inside panes.

## Launching panes

```bash
# Create a pane
OUTPUT=$(cmux new-pane --type terminal --direction right --cwd "$PWD")
SURFACE=$(echo "$OUTPUT" | grep -o 'surface:[0-9]*')

# Launch Claude agent in pane
cmux send --surface "$SURFACE" 'claude --dangerously-skip-permissions'
cmux send-key --surface "$SURFACE" enter
```

## Communication

```bash
# Send a message to a pane
cmux send --surface "$SURFACE" 'your message here'
cmux send-key --surface "$SURFACE" enter

# Read pane output
cmux read-screen --surface "$SURFACE"

# Close pane when done
cmux close-surface --surface "$SURFACE"
```

## Surface tracking

Write refs to `/tmp/work-cmux-surfaces` so any pane can address others:

```bash
echo "PLANNER=$PLANNER_SURFACE" > /tmp/work-cmux-surfaces
echo "IMPL=$IMPL_SURFACE" >> /tmp/work-cmux-surfaces
echo "CONTROL=$CMUX_SURFACE_ID" >> /tmp/work-cmux-surfaces
```

## Implementer rotation

After each TODO is approved:
1. Close the implementer pane: `cmux close-surface --surface "$IMPL_SURFACE"`
2. Create a fresh pane for the next TODO
3. Update `/tmp/work-cmux-surfaces` with the new IMPL surface

Fresh context per TODO = better focus, no context bloat.

## Signaling via work_handoff

Panes coordinate through `work_handoff` MCP tool (writes to `/tmp/work-cmux-signals.json`):

| From | Action | When |
|------|--------|------|
| planner | `plan-ready` | Plan is complete, ready for implementation |
| implementer | `todo-done` | TODO finished, commit made |
| implementer | `question` | Needs planner input |
| planner | `answer` | Responding to implementer question |
| implementer | `all-done` | All TODOs complete |
| implementer | `blocked` | Needs user intervention |

## Workflow

1. **Plan phase**: Create planner pane, send plan prompt, wait for `plan-ready` signal
2. **Implement phase**: For each TODO:
   - Create implementer pane with TODO-specific prompt
   - Wait for `todo-done` signal
   - Review and approve the commit
   - Close implementer pane
   - Repeat for next TODO
3. **Verify phase**: Close all panes, transition to verify
