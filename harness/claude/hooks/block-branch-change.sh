#!/bin/bash
command -v jq >/dev/null 2>&1 || exit 0
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
STRIPPED=$(echo "$CMD" | sed -E 's/^[[:space:]]*(env|sudo|command|builtin|exec|nohup)[[:space:]]+//')
STRIPPED=$(echo "$STRIPPED" | sed -E 's/^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+//')
FIRST=$(echo "$STRIPPED" | awk '{print $1}')
SECOND=$(echo "$STRIPPED" | awk '{print $2}')
case "$FIRST" in
  git)
    case "$SECOND" in
      checkout|switch)
        echo "BLOCKED: Branch switching ($FIRST $SECOND ...) is forbidden. Use git worktree or ask the user to switch branches manually." >&2
        exit 2
        ;;
    esac
    ;;
esac
exit 0
