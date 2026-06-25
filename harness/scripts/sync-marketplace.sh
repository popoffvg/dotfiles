#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLUGINS_DIR="$ROOT/harness/plugins"
MP_DIR="$ROOT/.claude-plugin"

mkdir -p "$MP_DIR"

declare -a entries=()

# Each plugin dir IS the plugin root (flat, no claude/ wrapper). The marketplace
# points directly at harness/plugins/<name> — no symlink layer.
for manifest in "$PLUGINS_DIR"/*/.claude-plugin/plugin.json; do
  [[ -f "$manifest" ]] || continue

  name=$(jq -r '.name' "$manifest")
  ver=$(jq -r '.version // "1.0.0"' "$manifest")
  desc=$(jq -r '.description // ""' "$manifest")

  entries+=("$(jq -nc \
      --arg name "$name" \
      --arg ver  "$ver" \
      --arg desc "$desc" \
      '{name:$name, source:"./harness/plugins/\($name)", description:$desc, version:$ver}')")
done

printf '%s\n' "${entries[@]}" | jq -s \
  '{name:"local-plugins", owner:{name:"popoffvg"}, plugins: .}' \
  > "$MP_DIR/marketplace.json"

echo "synced ${#entries[@]} plugins → $MP_DIR/marketplace.json"
