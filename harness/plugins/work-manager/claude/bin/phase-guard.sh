#!/usr/bin/env bash
# Phase guard hook — reads .pi/work.settings.json, blocks mutations in guarded phases (plan, plan-verify, verify).
# Called by PreToolUse hook for Bash|Edit|Write.
# Reads hook input from stdin (JSON with tool_name, tool_input).

set -euo pipefail

# Find settings file
find_settings() {
  local dir="$PWD"
  if [[ -f "$dir/.pi/work.settings.json" ]]; then
    echo "$dir/.pi/work.settings.json"
    return 0
  fi

  # Match TS behavior: only use subdir settings when exactly one exists.
  local matches=()
  local sub
  for sub in "$dir"/*/; do
    [[ -d "$sub" ]] || continue
    if [[ -f "${sub}.pi/work.settings.json" ]]; then
      matches+=("${sub}.pi/work.settings.json")
    fi
  done

  if [[ ${#matches[@]} -eq 1 ]]; then
    echo "${matches[0]}"
    return 0
  fi

  return 1
}

SETTINGS_FILE=$(find_settings 2>/dev/null) || exit 0

# Read phase and status
PHASE=$(jq -r '.phase // "unknown"' "$SETTINGS_FILE" 2>/dev/null) || exit 0
STATUS=$(jq -r '.status // "active"' "$SETTINGS_FILE" 2>/dev/null) || exit 0

# Only guard in read-only phases with active work
if [[ "$STATUS" != "active" ]]; then
  exit 0
fi

case "$PHASE" in
  plan|plan-verify|verify|implement) ;;  # guarded phases
  *) exit 0 ;;
esac

# Parse hook input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null) || exit 0
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // {}' 2>/dev/null) || exit 0

# Derive notes dir
TASK_DIR=$(dirname "$(dirname "$SETTINGS_FILE")")
NOTES_DIR="$TASK_DIR/_notes"

# Guard Bash commands
if [[ "$TOOL_NAME" == "Bash" ]]; then
  CMD=$(echo "$TOOL_INPUT" | jq -r '.command // ""' 2>/dev/null) || exit 0

  # Read-only commands allowed in plan + verify phases
  READ_ONLY_CMDS=$'cat\nhead\ntail\nless\ngrep\nrg\nfind\nls\ntree\nwc\nfile\nstat\necho\npwd\ngit log\ngit show\ngit diff\ngit status\ngit branch\ngh api\ngh pr list\ngh pr view\ngh pr status\ngh pr checks\ngh issue list\ngh issue view\ngh issue status\ngh run list\ngh run view\ngh repo view'

  # Test/lint commands additionally allowed in verify phase
  VERIFY_EXTRA_CMDS=$'go test\ngo vet\nnpm test\nnpm run test\nnpm run lint\npnpm test\npnpm run test\npnpm run lint\nyarn test\nmake test\nmake lint\nmake check\npytest\nruff\nmypy\nflake8\neslint\ngolangci-lint\nshellcheck\ntsc\nmise run test\nmise run lint'

  is_cmd_in_list() {
    local value="$1"
    local list="$2"
    while IFS= read -r prefix; do
      [[ -z "$prefix" ]] && continue
      if [[ "$value" == "$prefix" ]] || [[ "$value" == "$prefix "* ]]; then
        return 0
      fi
    done <<< "$list"
    return 1
  }

  CANDIDATE="$CMD"
  # Allow common wrapper form: "cd <dir> && <read-only>"
  if [[ "$CMD" =~ ^cd[[:space:]]+.+[[:space:]]*\&\&[[:space:]]*(.+)$ ]]; then
    CANDIDATE="${BASH_REMATCH[1]}"
  fi

  if [[ "$PHASE" == "plan" || "$PHASE" == "plan-verify" ]]; then
    # Plan phase: use settings-configurable list, fallback to read-only defaults
    ALLOWED=$(jq -r '.planAllowedCommands[]?' "$SETTINGS_FILE" 2>/dev/null) || ALLOWED=""
    if [[ -z "$ALLOWED" ]]; then
      ALLOWED="$READ_ONLY_CMDS"
    fi

    if ! is_cmd_in_list "$CANDIDATE" "$ALLOWED"; then
      echo '{"decision": "block", "reason": "Plan phase: bash commands that modify files are not allowed. Only reading/inspecting is permitted. Write your plan in _notes/ using edit/write tools."}'
      exit 0
    fi
  fi

  if [[ "$PHASE" == "verify" ]]; then
    # Verify phase: read-only + test/lint runners
    VERIFY_ALLOWED="${READ_ONLY_CMDS}
${VERIFY_EXTRA_CMDS}"

    if ! is_cmd_in_list "$CANDIDATE" "$VERIFY_ALLOWED"; then
      echo '{"decision": "block", "reason": "Verify phase: only read-only and test/lint commands are allowed. You are a reviewer — do not modify files via bash."}'
      exit 0
    fi
  fi

  if [[ "$PHASE" == "implement" ]]; then
    # Implement phase: block git staging and committing
    GIT_STAGE_CMDS=$'git add\ngit commit\ngit stage'
    if is_cmd_in_list "$CANDIDATE" "$GIT_STAGE_CMDS"; then
      echo '{"decision": "block", "reason": "Implement phase: git staging and committing are not allowed. Use /work:next to commit after a TODO is complete — it transitions to todo-done phase first."}'
      exit 0
    fi
  fi
fi

# Guard Edit/Write — restrict by phase
if [[ "$TOOL_NAME" == "Edit" ]] || [[ "$TOOL_NAME" == "Write" ]]; then
  FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // ""' 2>/dev/null) || exit 0

  if [[ -z "$FILE_PATH" ]]; then
    exit 0
  fi

  # Resolve to absolute path
  RESOLVED=$(cd "$(dirname "$FILE_PATH")" 2>/dev/null && echo "$(pwd)/$(basename "$FILE_PATH")") || RESOLVED="$FILE_PATH"
  NOTES_RESOLVED=$(cd "$NOTES_DIR" 2>/dev/null && pwd) || NOTES_RESOLVED="$NOTES_DIR"
  SETTINGS_RESOLVED=$(cd "$(dirname "$SETTINGS_FILE")" 2>/dev/null && pwd) || SETTINGS_RESOLVED="$(dirname "$SETTINGS_FILE")"
  WORK_SETTINGS_RESOLVED="$SETTINGS_RESOLVED/work.settings.json"

  is_allowed_path() {
    [[ "$RESOLVED" == "$NOTES_RESOLVED"* ]] && return 0
    return 1
  }

  if [[ "$PHASE" == "plan" || "$PHASE" == "plan-verify" ]]; then
    if ! is_allowed_path; then
      echo "{\"decision\": \"block\", \"reason\": \"Plan phase: cannot modify files outside _notes/. Tried to $TOOL_NAME: $FILE_PATH. Add this to the plan instead.\"}"
      exit 0
    fi
  fi

  if [[ "$PHASE" == "verify" ]]; then
    # Verify phase: allow _notes/ and .pi/work.settings.json only
    if is_allowed_path; then
      exit 0
    fi
    if [[ "$RESOLVED" == "$WORK_SETTINGS_RESOLVED" ]]; then
      exit 0
    fi
    echo "{\"decision\": \"block\", \"reason\": \"Verify phase: cannot modify source files. Only _notes/ and .pi/work.settings.json are allowed. You are a reviewer, not an implementer.\"}"
    exit 0
  fi
fi

# Allowed
exit 0
