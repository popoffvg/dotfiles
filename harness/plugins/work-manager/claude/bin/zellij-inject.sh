#!/usr/bin/env bash
# Inject Zellij context when running inside Zellij.
# SessionStart hook — outputs additionalContext JSON.

set -euo pipefail

if [[ -z "${ZELLIJ_SESSION_NAME:-}" ]]; then
  exit 0
fi

read -r -d '' CTX <<'MSG' || true
## Zellij Environment

You are running inside Zellij session. When executing work-manager TODOs (implement phase), launch each independent TODO as a separate Claude agent in its own Zellij pane:

```bash
zellij run -f -n "todo: <short-label>" --cwd "$PWD" -- \
  claude -p --dangerously-skip-permissions "<todo-prompt>"
```

- Each TODO = one floating pane (`-f`), named with the TODO summary
- Include full context in the prompt (file paths, acceptance criteria, constraints)
- Use `-w` (worktree) flag when TODOs touch overlapping files
- For sequential TODOs (dependencies), use `-s` (start-suspended) and trigger manually
- After all panes finish, verify results from the main pane
MSG

jq -n --arg ctx "$CTX" '{"additionalContext": $ctx}'
