#!/usr/bin/env bash
# Print the Claude Code theme that matches the current Zed appearance: light or dark.
# Zed's settings.json is JSONC, so the theme mode is read with awk and not with jq.

set -euo pipefail

light=${CLAUDE_THEME_LIGHT:-custom:catppuccin-latte-light}
dark=${CLAUDE_THEME_DARK:-custom:catppuccin-macchiato-dark}
settings=${ZED_SETTINGS:-$HOME/.config/zed/settings.json}

mode=system
if [[ -r $settings ]]; then
  found=$(awk '
    /^[[:space:]]*"theme"[[:space:]]*:[[:space:]]*\{/ { inside = 1; next }
    inside && /^[[:space:]]*\}/ { exit }
    inside && match($0, /"mode"[[:space:]]*:[[:space:]]*"[a-z]+"/) {
      value = substr($0, RSTART, RLENGTH); sub(/.*"mode"[[:space:]]*:[[:space:]]*"/, "", value); sub(/"$/, "", value)
      print value; exit
    }
  ' "$settings")
  [[ -n $found ]] && mode=$found
fi

if [[ $mode == system ]]; then
  if [[ $(defaults read -g AppleInterfaceStyle 2>/dev/null || true) == Dark ]]; then
    mode=dark
  else
    mode=light
  fi
fi

if [[ $mode == dark ]]; then
  printf '%s\n' "$dark"
else
  printf '%s\n' "$light"
fi
