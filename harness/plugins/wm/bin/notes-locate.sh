#!/usr/bin/env bash
# UserPromptSubmit hook: tell the model where wm thoughts + spec live.
# The .notes dir may sit in cwd or in any parent folder — walk up to find it.
# Emits one context line on stdout when found; silent otherwise.
set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null) || exit 0
[[ -z "$CWD" || ! -d "$CWD" ]] && exit 0

dir="$CWD"
while :; do
  if [[ -d "$dir/.notes" ]]; then
    notes="$dir/.notes"
    where="cwd"
    [[ "$dir" != "$CWD" ]] && where="parent ($dir)"
    line="wm notes at $notes ($where)."
    [[ -f "$notes/spec.md" ]] && line="$line spec: $notes/spec.md."
    [[ -d "$notes/thoughts" ]] && line="$line thoughts: $notes/thoughts/."
    [[ -d "$notes/todos" ]] && line="$line todos: $notes/todos/."
    echo "$line"
    exit 0
  fi
  parent=$(dirname "$dir")
  [[ "$parent" == "$dir" ]] && break   # reached filesystem root
  dir="$parent"
done

exit 0
