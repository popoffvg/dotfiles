#!/usr/bin/env bash
# Inject cmux context on SessionStart.
# Outputs additionalContext JSON when running inside cmux.

set -euo pipefail

if [[ -z "${CMUX_SURFACE_ID:-}" ]]; then
  exit 0
fi

read -r -d '' CTX <<'MSG' || true
## cmux Environment

You are running inside cmux. During work-manager implement phase, use the **3-pane cmux orchestration** pattern (skill: work-cmux):

1. **Planner** — persistent interactive Claude in a right split pane
2. **Implementer** — ephemeral interactive Claude, one per TODO, in another split pane
3. **You (control)** — orchestrate, approve, relay messages between them

### Quick reference

```bash
# Create pane
OUTPUT=$(cmux new-pane --type terminal --direction right --cwd "$(pwd)")
SURFACE=$(echo "$OUTPUT" | grep -o 'surface:[0-9]*')

# Launch agent
cmux send --surface "$SURFACE" 'claude --dangerously-skip-permissions'
cmux send-key --surface "$SURFACE" enter

# Send message
cmux send --surface "$SURFACE" 'your message'
cmux send-key --surface "$SURFACE" enter

# Read output
cmux read-screen --surface "$SURFACE"

# Close pane
cmux close-surface --surface "$SURFACE"
```

### Working directory

All panes MUST work in the **current directory** (`$(pwd)`). Always pass `--cwd "$(pwd)"` when creating panes. Do not change directories inside panes.

### Implementer rotation

After each TODO is approved, kill the implementer pane and create a fresh one for the next TODO. Fresh context = better focus.

### Surface tracking

Write refs to `/tmp/work-cmux-surfaces` so any pane can address others:
```bash
echo "PLANNER=$PLANNER_SURFACE" > /tmp/work-cmux-surfaces
echo "IMPL=$IMPL_SURFACE" >> /tmp/work-cmux-surfaces
```
MSG

jq -n --arg ctx "$CTX" '{"additionalContext": $ctx}'
