#!/usr/bin/env bash
# Install every *.plist in this directory as a user LaunchAgent.
# ~/Library is stow-ignored (runtime state), so LaunchAgents are copied, not
# symlinked. Idempotent: bootout before bootstrap, silent when not loaded.
set -euo pipefail

src_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
dest_dir="$HOME/Library/LaunchAgents"
mkdir -p "$dest_dir"

for plist in "$src_dir"/*.plist; do
  [ -e "$plist" ] || continue
  label=$(basename "$plist" .plist)
  cp "$plist" "$dest_dir/"
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$dest_dir/$(basename "$plist")"
  echo "loaded $label"
done
