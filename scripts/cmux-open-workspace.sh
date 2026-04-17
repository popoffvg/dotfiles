#!/usr/bin/env bash
set -euo pipefail

CMUX_BIN="/opt/homebrew/bin/cmux"

if [[ $# -lt 1 || $# -gt 3 ]]; then
  echo "usage: cmux-open-workspace.sh <workspace-title> [cwd] [mode]" >&2
  echo "mode: select (default) | create" >&2
  exit 2
fi

TITLE="$1"
CWD="${2:-$PWD}"
MODE="${3:-select}"

normalize() {
  local s="$1"
  s="$(printf '%s' "$s" | tr '[:upper:]' '[:lower:]')"
  s="$(printf '%s' "$s" | sed -E 's/[[:space:]]+/-/g')"
  s="$(printf '%s' "$s" | sed -E 's/[^a-z0-9_-]//g')"
  s="$(printf '%s' "$s" | sed -E 's/-+/-/g')"
  s="$(printf '%s' "$s" | sed -E 's/^[-_]+//; s/[-_]+$//')"
  printf '%s' "$s"
}

extract_ref_and_title() {
  local line="$1"
  line="${line#\* }"
  line="$(printf '%s' "$line" | sed -E 's/^\s+//')"
  if [[ "$line" =~ ^(workspace:[0-9]+)[[:space:]]+(.*)$ ]]; then
    local ref="${BASH_REMATCH[1]}"
    local title="${BASH_REMATCH[2]}"
    # cmux may append status tokens like "[selected]" to list output.
    title="$(printf '%s' "$title" | sed -E 's/[[:space:]]+\[[^]]+\][[:space:]]*$//')"
    title="$(printf '%s' "$title" | sed -E 's/[[:space:]]+$//')"
    printf '%s\t%s\n' "$ref" "$title"
  fi
}

"$CMUX_BIN" . >/dev/null

mapfile -t LINES < <("$CMUX_BIN" list-workspaces)

TARGET_REF=""
TARGET_TITLE_LC="$(printf '%s' "$TITLE" | tr '[:upper:]' '[:lower:]')"
TARGET_NORM="$(normalize "$TITLE")"

# 1) exact case-insensitive title match
for line in "${LINES[@]}"; do
  parsed="$(extract_ref_and_title "$line")"
  [[ -z "$parsed" ]] && continue
  ref="${parsed%%$'\t'*}"
  ws_title="${parsed#*$'\t'}"
  ws_title_lc="$(printf '%s' "$ws_title" | tr '[:upper:]' '[:lower:]')"
  if [[ "$ws_title_lc" == "$TARGET_TITLE_LC" ]]; then
    TARGET_REF="$ref"
    break
  fi
done

# 2) normalized title match
if [[ -z "$TARGET_REF" ]]; then
  for line in "${LINES[@]}"; do
    parsed="$(extract_ref_and_title "$line")"
    [[ -z "$parsed" ]] && continue
    ref="${parsed%%$'\t'*}"
    ws_title="${parsed#*$'\t'}"
    if [[ "$(normalize "$ws_title")" == "$TARGET_NORM" ]]; then
      TARGET_REF="$ref"
      break
    fi
  done
fi

if [[ "$MODE" == "create" ]]; then
  created="$($CMUX_BIN new-workspace --cwd "$CWD")"
  if [[ "$created" =~ (workspace:[0-9]+) ]]; then
    TARGET_REF="${BASH_REMATCH[1]}"
  else
    echo "failed to parse new workspace ref: $created" >&2
    exit 1
  fi
  "$CMUX_BIN" rename-workspace --workspace "$TARGET_REF" "$TITLE" >/dev/null
elif [[ -z "$TARGET_REF" ]]; then
  created="$($CMUX_BIN new-workspace --cwd "$CWD")"
  if [[ "$created" =~ (workspace:[0-9]+) ]]; then
    TARGET_REF="${BASH_REMATCH[1]}"
  else
    echo "failed to parse new workspace ref: $created" >&2
    exit 1
  fi
  "$CMUX_BIN" rename-workspace --workspace "$TARGET_REF" "$TITLE" >/dev/null
fi

"$CMUX_BIN" select-workspace --workspace "$TARGET_REF" >/dev/null
printf '%s\n' "$TARGET_REF"
