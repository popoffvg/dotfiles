#!/usr/bin/env bash
# PreToolUse(Skill) hook: when the `code` skill is invoked, record the current
# branch as the code-mode slug. All logic lives in the sibling script
# bin/wm-code-mode.sh (see its header). Silent for any other skill.
set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null) || exit 0
[[ "$TOOL" == "Skill" ]] || exit 0
SKILL=$(echo "$INPUT" | jq -r '.tool_input.skill // ""' 2>/dev/null) || exit 0
[[ "$SKILL" == "code" || "$SKILL" == "wm:code" ]] || exit 0
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null) || exit 0
[[ -n "$CWD" ]] || exit 0

"$CLAUDE_PLUGIN_ROOT/bin/wm-code-mode.sh" mark "$CWD" || true
exit 0
