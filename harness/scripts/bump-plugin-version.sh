#!/usr/bin/env bash
# Bump MINOR version in plugin.json for any plugin with staged changes.
# Re-runs sync-marketplace.sh and stages the updated files.
# Plugin dirs are flat: harness/plugins/<name>/.claude-plugin/plugin.json
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PLUGINS_DIR="$ROOT/harness/plugins"

staged=$(git diff --cached --name-only)

bumped=0
for manifest in "$PLUGINS_DIR"/*/.claude-plugin/plugin.json; do
  [[ -f "$manifest" ]] || continue
  name=$(basename "$(dirname "$(dirname "$manifest")")")

  # Bump only if a staged file lives inside this plugin
  if ! echo "$staged" | grep -q "^harness/plugins/$name/"; then
    continue
  fi

  # Guard: skip if staged diff is ONLY the version field (avoid re-bumping)
  staged_diff=$(git diff --cached -- "$manifest" 2>/dev/null || true)
  if [[ -n "$staged_diff" ]]; then
    non_version_lines=$(echo "$staged_diff" | grep '^[+-]' | grep -v '^---\|^+++' | grep -v '"version"' | wc -l)
    if [[ "$non_version_lines" -eq 0 ]]; then
      echo "bump-plugin-version: $name — skipping (only version field staged)"
      continue
    fi
  fi

  # Bump minor version: x.Y.z -> x.(Y+1).0
  current=$(jq -r '.version' "$manifest")
  major=$(echo "$current" | cut -d. -f1)
  minor=$(echo "$current" | cut -d. -f2)
  new_version="$major.$((minor + 1)).0"

  jq --arg v "$new_version" '.version = $v' "$manifest" > "${manifest}.tmp" && mv "${manifest}.tmp" "$manifest"
  git add "$manifest"
  echo "bump-plugin-version: $name $current -> $new_version"
  bumped=$((bumped + 1))
done

if [[ "$bumped" -gt 0 ]]; then
  bash "$ROOT/harness/scripts/sync-marketplace.sh"
  git add "$ROOT/.claude-plugin/marketplace.json"
fi
