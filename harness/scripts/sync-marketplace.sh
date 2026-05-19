#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLUGINS_DIR="$ROOT/harness/plugins"
MP_DIR="$ROOT/harness/claude/plugins/local-plugins"

mkdir -p "$MP_DIR/.claude-plugin"

declare -a entries=()

for plugin_root in "$PLUGINS_DIR"/*/claude; do
  manifest="$plugin_root/.claude-plugin/plugin.json"
  [[ -f "$manifest" ]] || continue

  name=$(jq -r '.name'        "$manifest")
  ver=$(jq -r '.version // "1.0.0"' "$manifest")
  desc=$(jq -r '.description // ""' "$manifest")

  ln -snf "../../../plugins/$name/claude" "$MP_DIR/$name"

  entries+=("$(jq -nc \
      --arg name "$name" \
      --arg ver  "$ver" \
      --arg desc "$desc" \
      '{name:$name, source:"./\($name)", description:$desc, version:$ver}')")
done

for link in "$MP_DIR"/*; do
  [[ -L "$link" ]] || continue
  name=$(basename "$link")
  [[ -d "$PLUGINS_DIR/$name/claude/.claude-plugin" ]] || { rm "$link"; echo "rm stale: $name"; }
done

printf '%s\n' "${entries[@]}" | jq -s \
  '{name:"local-plugins", owner:{name:"popoffvg"}, plugins: .}' \
  > "$MP_DIR/.claude-plugin/marketplace.json"

echo "synced ${#entries[@]} plugins → $MP_DIR/.claude-plugin/marketplace.json"
