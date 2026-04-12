#!/usr/bin/env bash
# Install skill-manager Claude Code plugin.
# Adds plugin path to .claude/settings.json and grants required permissions.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$SCRIPT_DIR/claude"

echo "[skill-manager] Installing Claude Code plugin from: $PLUGIN_DIR"

# Check jq is available
if ! command -v jq &>/dev/null; then
  echo "Error: jq is required. Install via: brew install jq" >&2
  exit 1
fi

# Find project settings
if [[ -f ".claude/settings.json" ]]; then
  SETTINGS=".claude/settings.json"
elif [[ -f "$HOME/.claude/settings.json" ]]; then
  SETTINGS="$HOME/.claude/settings.json"
else
  echo "Error: No .claude/settings.json found" >&2
  exit 1
fi

echo "[skill-manager] Using settings: $SETTINGS"

# Add plugin path if not already registered
CURRENT_PLUGINS=$(jq -r '.plugins // [] | .[]' "$SETTINGS" 2>/dev/null) || CURRENT_PLUGINS=""
if echo "$CURRENT_PLUGINS" | grep -qF "$PLUGIN_DIR"; then
  echo "[skill-manager] Plugin already registered"
else
  jq --arg path "$PLUGIN_DIR" '.plugins = ((.plugins // []) + [$path] | unique)' "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"
  echo "[skill-manager] Plugin registered in settings"
fi

echo "[skill-manager] Installation complete. Restart Claude Code to activate."
