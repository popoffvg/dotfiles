#!/usr/bin/env bash
# UserPromptSubmit hook: Detects if the user's prompt contains new requirements
# for the active work. If so, injects a reminder to update the work note.
set -euo pipefail

LOG_FILE="$HOME/.claude/debug/work-requirements-hook.log"
TASKS_ROOT="$HOME/Documents/git/mil/tasks"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE" 2>/dev/null || true; }

INPUT=$(cat /dev/stdin)

CWD=$(echo "$INPUT" | jq -r '.cwd // ""')
USER_PROMPT=$(echo "$INPUT" | jq -r '.user_prompt // ""')

# Skip short prompts
if [[ ${#USER_PROMPT} -lt 10 ]]; then
  log "INFO Prompt too short, skipping"
  exit 0
fi

# Find work file
WORK_FILE=""

# Strategy 1: check if cwd is inside a tasks folder
if [[ "$CWD" == "$TASKS_ROOT"/* ]]; then
  RELATIVE="${CWD#$TASKS_ROOT/}"
  BRANCH_DIR="${RELATIVE%%/*}"
  if [[ -n "$BRANCH_DIR" && -f "$TASKS_ROOT/$BRANCH_DIR/_summary.md" ]]; then
    WORK_FILE="$TASKS_ROOT/$BRANCH_DIR/_summary.md"
  fi
fi

# Strategy 2: check if current repo branch matches a work folder
if [[ -z "$WORK_FILE" ]]; then
  BRANCH=$(git -C "$CWD" branch --show-current 2>/dev/null || true)
  if [[ -n "$BRANCH" && -f "$TASKS_ROOT/$BRANCH/_summary.md" ]]; then
    WORK_FILE="$TASKS_ROOT/$BRANCH/_summary.md"
  fi
fi

if [[ -z "$WORK_FILE" ]]; then
  log "INFO No _summary.md found for cwd $CWD, skipping"
  exit 0
fi

WORK_CONTEXT=$(head -c 2000 "$WORK_FILE")
PROMPT_EXCERPT=$(echo "$USER_PROMPT" | head -c 2000)

log "INFO Checking prompt against work file $WORK_FILE"

# Ask Haiku if prompt contains new requirements
API_KEY="${ANTHROPIC_API_KEY:-}"
if [[ -z "$API_KEY" ]]; then
  log "ERROR ANTHROPIC_API_KEY not set"
  exit 0
fi

CLASSIFICATION_PROMPT=$(jq -n \
  --arg work "$WORK_CONTEXT" \
  --arg prompt "$PROMPT_EXCERPT" \
  '{
    model: "claude-haiku-4-5-20251001",
    max_tokens: 10,
    messages: [{
      role: "user",
      content: ("You are a work requirements detector.\n\nCURRENT WORK:\n---\n" + $work + "\n---\n\nUSER PROMPT:\n---\n" + $prompt + "\n---\n\nDoes the user prompt contain NEW requirements not already in the work note?\nNew requirements = new features, changed scope, new constraints, new technical decisions, bug reports expanding scope.\nNOT new requirements = questions, status checks, implementation details for existing scope, confirmations, debugging.\n\nRespond with ONLY one word: YES or NO")
    }]
  }')

RESPONSE=$(curl -s -X POST "https://api.anthropic.com/v1/messages" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$CLASSIFICATION_PROMPT" 2>/dev/null) || {
  log "ERROR curl failed"
  exit 0
}

# Check for API error
if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
  log "ERROR API error: $(echo "$RESPONSE" | jq -r '.error')"
  exit 0
fi

ANSWER=$(echo "$RESPONSE" | jq -r '.content[0].text // ""' | tr '[:lower:]' '[:upper:]')
log "INFO Haiku answer: $ANSWER"

if [[ "$ANSWER" == YES* ]]; then
  jq -n --arg file "$WORK_FILE" '{
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ("New work requirements detected in this prompt. After addressing the request, update the work note at `" + $file + "` with the new requirements/decisions.")
    }
  }'
fi

exit 0
