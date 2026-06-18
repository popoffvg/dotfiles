#!/usr/bin/env bash
# Regroup wm skills under category prefixes.
# Handles BOTH repo symlinks (-> global store) and repo real dirs uniformly:
#   - symlink entry: rename the global-store dir, recreate the repo symlink with the new name
#   - real-dir entry: move the repo dir to the new name
# Fixes the SKILL.md `name:` frontmatter to match the new dir name.
# DELETE pairs (new == __DELETE__) only remove the repo entry (symlink); global orphan is left.
# Idempotent-ish: skips a rename if the source is gone and the target already exists.
#
# Usage: regroup-work-skills.sh <repo-skills-dir> <old:new> [<old:new> ...]
set -euo pipefail

REPO="$1"; shift
STORE="$HOME/.pi/agent/skills"

fix_name() {  # $1 = SKILL.md path, $2 = new name
  [ -f "$1" ] || return 0
  perl -i -pe 'if (/^name:/ && !$done) { $_ = "name: '"$2"'\n"; $done = 1 }' "$1"
}

for pair in "$@"; do
  old="${pair%%:*}"; new="${pair##*:}"
  src="$REPO/$old"

  if [ "$new" = "__DELETE__" ]; then
    if [ -L "$src" ]; then rm -f "$src"; echo "deleted (symlink): $old"
    elif [ -d "$src" ]; then echo "SKIP delete (real dir, not removing): $old"
    else echo "delete: $old already absent"; fi
    continue
  fi

  if [ -L "$src" ]; then
    gdir="$(basename "$(readlink "$src")")"
    if [ "$gdir" != "$new" ] && [ -d "$STORE/$gdir" ] && [ ! -e "$STORE/$new" ]; then
      mv "$STORE/$gdir" "$STORE/$new"
    fi
    rm -f "$src"
    ln -sfn "$STORE/$new" "$REPO/$new"
    fix_name "$STORE/$new/SKILL.md" "$new"
    echo "symlink: $old -> $new"
  elif [ -d "$src" ]; then
    if [ ! -e "$REPO/$new" ]; then mv "$src" "$REPO/$new"; fi
    fix_name "$REPO/$new/SKILL.md" "$new"
    echo "realdir: $old -> $new"
  else
    echo "MISSING source: $old"
  fi
done
