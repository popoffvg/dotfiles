#!/usr/bin/env bash
# Remove symlinks under a skills directory whose target no longer resolves.
# Stow creates the links but never reaps them, so a skill deleted from the repo
# stays live on every machine that pulled it until something removes the link.
set -euo pipefail

dir="${1:-$HOME/.claude/skills}"
dry=0
[ "${2:-}" = "--dry-run" ] || [ "${1:-}" = "--dry-run" ] && dry=1
[ "${1:-}" = "--dry-run" ] && dir="${2:-$HOME/.claude/skills}"

if [ ! -d "$dir" ]; then
  echo "no such directory: $dir" >&2
  exit 1
fi

removed=0
while IFS= read -r link; do
  [ -e "$link" ] && continue
  if [ "$dry" -eq 1 ]; then
    echo "would remove $link -> $(readlink "$link")"
  else
    echo "removed $link -> $(readlink "$link")"
    rm -- "$link"
  fi
  removed=$((removed + 1))
done < <(find "$dir" -maxdepth 1 -mindepth 1 -type l)

echo "$removed stale link(s) in $dir"
