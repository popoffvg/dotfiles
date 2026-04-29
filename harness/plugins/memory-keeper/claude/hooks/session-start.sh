#!/usr/bin/env bash
# SessionStart hook: Injects project context from ~/ctx/insights/ into the
# session so Claude has relevant knowledge loaded before the first message.
set -euo pipefail

LOG_FILE="$HOME/.claude/debug/session-start-hook.log"

# --- Load config from memory-keeper.local.md ---
load_config() {
  local config_file="$HOME/.claude/memory-keeper.local.md"
  local key="$1"
  local default="$2"
  if [[ ! -f "$config_file" ]]; then
    echo "$default"
    return
  fi
  local in_frontmatter=0
  while IFS= read -r line; do
    if [[ "$line" == "---" ]]; then
      if [[ "$in_frontmatter" -eq 1 ]]; then
        break
      fi
      in_frontmatter=1
      continue
    fi
    if [[ "$in_frontmatter" -eq 1 ]]; then
      local k v
      k=$(echo "$line" | cut -d: -f1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      v=$(echo "$line" | cut -d: -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      if [[ "$k" == "$key" && -n "$v" ]]; then
        echo "${v/#\~/$HOME}"
        return
      fi
    fi
  done < "$config_file"
  echo "$default"
}

INSIGHTS_ROOT=$(load_config "insights_root" "")

if [[ -z "$INSIGHTS_ROOT" ]]; then
  log "WARN insights_root not configured in ~/.claude/memory-keeper.local.md, skipping"
  exit 0
fi

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE" 2>/dev/null || true; }

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
