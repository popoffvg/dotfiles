#!/usr/bin/env bash
# Sum the frontmatter (name+description) bytes of every SKILL.md reachable from a root, per root.
set -uo pipefail
for root in "$@"; do
  [ -d "$root" ] || continue
  n=0; b=0
  while IFS= read -r f; do
    s=$(awk 'f==1&&/^---$/{exit} /^---$/{f=1;next} f' "$f" | wc -c)
    n=$((n+1)); b=$((b+s))
  done < <(find "$root" -name SKILL.md -type f 2>/dev/null)
  printf '%-60s skills=%-4d chars=%-7d est_tokens=%d\n' "$root" "$n" "$b" "$((b/4))"
done
