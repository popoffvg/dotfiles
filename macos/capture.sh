#!/usr/bin/env bash
# Capture ALL macOS `defaults` domains to macos/dump/<domain>.plist.
# Output is git-ignored (see macos/.gitignore) — it contains app state and
# possibly secrets. Use it to diff/restore on the SAME or a NEW machine.
#
#   ./capture.sh            # dump every domain + the global domain
#   ./capture.sh com.apple  # dump only domains whose name matches a substring
set -euo pipefail

cd "$(dirname "$0")"
out="dump"
filter="${1:-}"
mkdir -p "$out"

# Global domain (NSGlobalDomain / -g)
defaults export -g "$out/_global.plist"

n=1
# `defaults domains` is a single comma-separated line.
defaults domains | tr ',' '\n' | sed 's/^ *//;s/ *$//' | while IFS= read -r domain; do
  [ -z "$domain" ] && continue
  if [ -n "$filter" ] && [[ "$domain" != *"$filter"* ]]; then continue; fi
  # Sanitize domain → filename: spaces/slashes to underscores.
  safe="${domain// /_}"; safe="${safe//\//_}"
  if defaults export "$domain" "$out/${safe}.plist" 2>/dev/null; then
    n=$((n+1))
  fi
done

count=$(find "$out" -name '*.plist' | wc -l | tr -d ' ')
echo "Captured $count domains → $out/"
echo "Restore one with:  defaults import <domain> $out/<file>.plist"
