#!/usr/bin/env bash
# Phase context injection hook.
# Called by PostCompact to re-inject phase context after compaction.
# Returns additionalContext with phase rules.

set -euo pipefail

MODE="${1:-}"

# Find settings file
find_settings() {
  local dir="$PWD"
  if [[ -f "$dir/.pi/work.settings.json" ]]; then
    echo "$dir/.pi/work.settings.json"
    return 0
  fi
  for sub in "$dir"/*/; do
    if [[ -f "${sub}.pi/work.settings.json" ]]; then
      echo "${sub}.pi/work.settings.json"
      return 0
    fi
  done
  return 1
}

SETTINGS_FILE=$(find_settings 2>/dev/null) || exit 0

PHASE=$(jq -r '.phase // "unknown"' "$SETTINGS_FILE" 2>/dev/null) || exit 0
STATUS=$(jq -r '.status // "active"' "$SETTINGS_FILE" 2>/dev/null) || exit 0
WORK_ID=$(jq -r '.workId // ""' "$SETTINGS_FILE" 2>/dev/null) || WORK_ID=""
NAME=$(jq -r '.name // ""' "$SETTINGS_FILE" 2>/dev/null) || NAME=""

if [[ "$STATUS" != "active" ]]; then
  exit 0
fi

# Build context
LABEL="${WORK_ID:-$NAME}"
TASK_DIR=$(dirname "$(dirname "$SETTINGS_FILE")")
NOTES_DIR="$TASK_DIR/_notes"

# Read recent worklog
WORKLOG=""
if [[ -f "$NOTES_DIR/worklog.md" ]]; then
  WORKLOG=$(grep "^- " "$NOTES_DIR/worklog.md" | tail -10)
fi

CONTEXT="## Work Context (post-compaction)

**Active Work:** ${LABEL}
**Phase:** ${PHASE}

### Phase Rules
"

case "$PHASE" in
  plan)
    CONTEXT+="You are in **plan** phase. You are a PLANNER, not an executor.
- NEVER write code or edit source files outside _notes/
- ALL user messages are plan input
- You may READ any file. You may ONLY WRITE to _notes/"
    ;;
  implement)
    CONTEXT+="You are in **implement** phase. Execute TODOs from _notes/plan.md.
- Each TODO = one git commit
- Call work_compact after each TODO
- Work autonomously"
    ;;
  plan-verify)
    CONTEXT+="You are in **plan-verify** phase. You are an AUDITOR, not a planner or executor.
- READ the plan and codebase to verify plan quality
- NEVER write code or edit source files outside _notes/
- Produce a verification report, then auto-transition:
  - If READY (0 FAILs): call work_transition with phase=implement
  - If NEEDS REVISION (1+ FAILs): call work_transition with phase=plan and feedback=<findings>"
    ;;
  research)
    CONTEXT+="You are in **research** phase. Explore and gather context.
- Save findings to _notes/research-*.md
- No code changes"
    ;;
  verify|verified)
    CONTEXT+="You are in **${PHASE}** phase. Review implementation results."
    ;;
esac

if [[ -n "$WORKLOG" ]]; then
  CONTEXT+="

### Recent Progress
\`\`\`
${WORKLOG}
\`\`\`"
fi

# Output as JSON additionalContext
jq -n --arg ctx "$CONTEXT" '{"additionalContext": $ctx}'
