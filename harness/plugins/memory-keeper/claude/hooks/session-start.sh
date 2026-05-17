#!/usr/bin/env bash
# SessionStart hook: Injects project context from insights root into the
# session so Claude has relevant knowledge loaded before the first message.
set -euo pipefail

LOG_FILE="$HOME/.claude/debug/session-start-hook.log"
CONFIG_FILE="$HOME/.config/mem-keeper/config.json"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE" 2>/dev/null || true; }

if [[ ! -f "$CONFIG_FILE" ]]; then
  log "WARN config missing at $CONFIG_FILE, skipping"
  exit 0
fi

INSIGHTS_ROOT=$(jq -r '.insights_root // .insightsRoot // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
INSIGHTS_ROOT="${INSIGHTS_ROOT/#\~/$HOME}"

if [[ -z "$INSIGHTS_ROOT" ]]; then
  log "WARN insights_root not configured in $CONFIG_FILE, skipping"
  exit 0
fi

INPUT=$(cat /dev/stdin)
CWD=$(echo "$INPUT" | jq -r '.cwd // ""')

log "INFO SessionStart hook triggered, cwd: $CWD"

CONTEXT=""

# --- Find project summary from insights ---
if [[ -n "$CWD" && -d "$INSIGHTS_ROOT" ]]; then
  # Detect project from git repo name, fallback to cwd basename
  GIT_ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || true)
  if [[ -n "$GIT_ROOT" ]]; then
    DETECTED_PROJECT=$(basename "$GIT_ROOT")
  else
    DETECTED_PROJECT=$(basename "$CWD")
  fi
  DETECTED_LOWER=$(echo "$DETECTED_PROJECT" | tr '[:upper:]' '[:lower:]')
  log "INFO Detected project: $DETECTED_PROJECT"

  # Try exact match first, then substring match
  for PROJECT_DIR in "$INSIGHTS_ROOT"/*/; do
    [[ -d "$PROJECT_DIR" ]] || continue
    PROJECT=$(basename "$PROJECT_DIR")
    PROJECT_LOWER=$(echo "$PROJECT" | tr '[:upper:]' '[:lower:]')
    if [[ "$DETECTED_LOWER" == "$PROJECT_LOWER" ]]; then
      SUMMARY="$PROJECT_DIR/_summary.md"
      if [[ -f "$SUMMARY" ]]; then
        CONTEXT=$(cat "$SUMMARY")
        log "INFO Exact match project '$PROJECT' for '$DETECTED_PROJECT'"
        break
      fi
    fi
  done

  # Fallback: substring match on full cwd path
  if [[ -z "$CONTEXT" ]]; then
    CWD_LOWER=$(echo "$CWD" | tr '[:upper:]' '[:lower:]')
    for PROJECT_DIR in "$INSIGHTS_ROOT"/*/; do
      [[ -d "$PROJECT_DIR" ]] || continue
      PROJECT=$(basename "$PROJECT_DIR")
      PROJECT_LOWER=$(echo "$PROJECT" | tr '[:upper:]' '[:lower:]')
      if [[ "$CWD_LOWER" == *"$PROJECT_LOWER"* ]]; then
        SUMMARY="$PROJECT_DIR/_summary.md"
        if [[ -f "$SUMMARY" ]]; then
          CONTEXT=$(cat "$SUMMARY")
          log "INFO Substring match project '$PROJECT' for cwd '$CWD'"
          break
        fi
      fi
    done
  fi
fi

# --- Fallback: INDEX.md ---
if [[ -z "$CONTEXT" && -f "$INSIGHTS_ROOT/INDEX.md" ]]; then
  CONTEXT=$(cat "$INSIGHTS_ROOT/INDEX.md")
  log "INFO Loading fallback INDEX.md"
fi

# --- Output ---
if [[ -z "$CONTEXT" ]]; then
  log "INFO No context to inject, exiting"
  exit 0
fi

log "INFO Injecting context (${#CONTEXT} chars)"

jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ("Context knowledge base loaded:\n\n" + $ctx + "\n\nIMPORTANT: Spawn the context-keeper agent now to check persistent memory for the current working directory. Do this immediately, before responding to the user.")
  }
}'
