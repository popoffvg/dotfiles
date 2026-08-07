#!/usr/bin/env bash
# SessionStart hook: tell the model to read the wm `code` skill before working.
# Two ways to reach that:
#   - git repo   -> code mode is branch-scoped; ask bin/wm-code-mode.sh check.
#   - no git repo -> branch gating cannot work. A .notes dir found by walking up
#     is the only signal left, so treat its presence as code mode ENABLED.
# Silent otherwise (no git AND no .notes).
set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null) || exit 0
[[ -n "$CWD" && -d "$CWD" ]] || exit 0

# Walk up from <dir> to the nearest existing .notes; echo its path or nothing.
resolve_notes() {
  local dir="$1" parent
  while :; do
    [[ -d "$dir/.notes" ]] && { printf '%s' "$dir/.notes"; return 0; }
    parent=$(dirname "$dir")
    [[ "$parent" == "$dir" ]] && return 1
    dir="$parent"
  done
}

if git -C "$CWD" rev-parse --git-dir >/dev/null 2>&1; then
  if "$CLAUDE_PLUGIN_ROOT/bin/wm-code-mode.sh" check "$CWD"; then
    echo "wm: code mode ENABLED on this branch. Read the /code skill (wm:code) and follow its pipeline before implementing."
  fi
  exit 0
fi

notes=$(resolve_notes "$CWD") || exit 0
line="wm: no git repo — code mode ENABLED (branch gating unavailable). notes at $notes."
line="$line Read the /code skill (wm:code) and follow its pipeline before implementing."
# Name the corpus files only once they exist — `/code new` Step 0 writes them.
[[ -f "$notes/CLAUDE.md" ]] && line="$line Corpus rules: $notes/CLAUDE.md."
[[ -f "$notes/RULES.md" ]] && line="$line What to ask directly: $notes/RULES.md."
echo "$line"
exit 0
