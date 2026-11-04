#!/usr/bin/env bash
# EDITOR for a Zed terminal: open the files in the Zed window on screen, wait for
# the tabs to close, then return the focus to the agent thread (zed-focus-agent.sh).
# A Claude Code Ctrl+G buffer (claude-prompt-<id>.md) opens as claude-prompt-<id>.prompt and moves back on close.
# It also shows .notes/handoff.prompt below the marker line, and the marker and all below it are cut on close.
set -euo pipefail

marker='<!-- session context: cut when this tab closes -->'
# The working directory can be deleted while a session runs in it; then the handoff is skipped.
root=$(git rev-parse --show-toplevel 2>/dev/null || pwd 2>/dev/null) || root=''
handoff="$root/.notes/handoff.prompt"

opened=()
for file in "$@"; do
  case "$(basename "$file")" in
    claude-prompt-*.md)
      prompt="${file%.md}.prompt"
      mv -- "$file" "$prompt"
      if [[ -s $handoff ]]; then
        printf '\n\n%s\n%s\n' "$marker" "$(cat "$handoff")" >>"$prompt"
      fi
      opened+=("$prompt")
      ;;
    *) opened+=("$file") ;;
  esac
done

zed --existing --wait -- "${opened[@]}" || true

for file in "${opened[@]}"; do
  [[ $file == *.prompt ]] || continue
  draft=$(awk -v m="$marker" '$0 == m { exit } { print }' "$file")
  printf '%s\n' "$draft" >"${file%.prompt}.md"
  rm -f -- "$file"
done
"$(dirname "$0")/zed-focus-agent.sh"
