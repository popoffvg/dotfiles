#!/usr/bin/env bash
# Rename mispec atom files to embed `kind` after the id: A-NNNN-<slug>.md -> A-NNNN-<kind>-<slug>.md
# Skips files whose slug already starts with the kind. Uses `git mv`. Idempotent.
# Usage: mispec-rename-kind.sh <dir> [<dir> ...]   (dirs holding A-*.md atom files)
set -euo pipefail

for dir in "$@"; do
  [ -d "$dir" ] || { echo "skip (no dir): $dir"; continue; }
  for f in "$dir"/A-[0-9][0-9][0-9][0-9]-*.md; do
    [ -e "$f" ] || continue
    base="$(basename "$f")"
    id="${base%%-*}"                       # A-NNNN  (first dash-delimited token is "A")
    id="$(echo "$base" | grep -oE '^A-[0-9]{4}')"
    rest="${base#${id}-}"                  # slug.md
    rest="${rest%.md}"                     # slug
    kind="$(grep -m1 '^kind:' "$f" | sed 's/^kind:[[:space:]]*//' | tr -d '[:space:]')"
    [ -n "$kind" ] || { echo "no kind, skip: $base"; continue; }
    case "$rest" in
      "$kind"|"$kind"-*) echo "already kinded: $base"; continue;;
    esac
    new="$dir/${id}-${kind}-${rest}.md"
    git mv "$f" "$new" && echo "renamed: $base -> $(basename "$new")"
  done
done
