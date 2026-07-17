#!/usr/bin/env bash
# SessionStart hook: if code mode is enabled for the current branch, tell the
# model to read the wm `code` skill before working. Enable state is computed by
# the sibling script bin/wm-code-mode.sh. Silent otherwise.
set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null) || exit 0
[[ -n "$CWD" && -d "$CWD" ]] || exit 0

if "$CLAUDE_PLUGIN_ROOT/bin/wm-code-mode.sh" check "$CWD"; then
  echo "wm: code mode ENABLED on this branch. Read the /code skill (wm:code) and follow its pipeline before implementing."
fi
exit 0
