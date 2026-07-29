#!/usr/bin/env bash
# Survey every git repo under a root: branch, dirty state, upstream, ahead/behind.
# Read-only. Usage: repos-survey.sh <root-dir> [out.tsv]
set -uo pipefail

ROOT="${1:?root dir required}"
OUT="${2:-/dev/stdout}"

{
printf 'repo\tbranch\tdirty\tupstream\tahead\tbehind\thead\n'
for d in "$ROOT"/*/; do
  n="$(basename "$d")"
  [ -d "$d/.git" ] || continue
  br="$(git -C "$d" symbolic-ref --short -q HEAD || echo DETACHED)"
  dirty="$(git -C "$d" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
  up="$(git -C "$d" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo none)"
  ahead=0; behind=0
  if [ "$up" != none ]; then
    read -r behind ahead <<<"$(git -C "$d" rev-list --left-right --count "$up...HEAD" 2>/dev/null || echo '0 0')"
  fi
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$n" "$br" "$dirty" "$up" "$ahead" "$behind" "$(git -C "$d" rev-parse --short HEAD 2>/dev/null)"
done
} > "$OUT"
