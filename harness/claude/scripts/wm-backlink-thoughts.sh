#!/usr/bin/env bash
# Append "## Depends on" / "## Affects" bullets to wm thought notes, idempotently.
#
# Usage: wm-backlink-thoughts.sh <thoughts-dir> <edge-file>
#   <edge-file> lines: "<note-id>|<section>|<target-id>|<annotation>"
#   section is a heading name, e.g. "Depends on" or "Affects".
# Note ids are the NNN- filename prefix. Blank lines and #-comments are skipped.
# A bullet already present in that section is left alone, so reruns are safe.
set -euo pipefail

DIR="${1:?thoughts dir}"
EDGES="${2:?edge file}"

resolve() {
  local f
  f=$(ls "$DIR"/"$1"-*.md 2>/dev/null | head -1)
  [ -n "$f" ] || { echo "no note with id $1 in $DIR" >&2; exit 1; }
  printf '%s' "$f"
}

n=0
while IFS='|' read -r id section target annot; do
  [ -z "${id// }" ] && continue
  case "$id" in \#*) continue ;; esac

  file=$(resolve "$id")
  tslug=$(basename "$(resolve "$target")" .md)
  bullet="- [[${tslug}]] — ${annot}"

  # Already listed under this exact section? then skip.
  if SEC="$section" SLUG="$tslug" awk '
      $0 == "## " ENVIRON["SEC"] { inside = 1; next }
      /^## / { inside = 0 }
      inside && index($0, "[[" ENVIRON["SLUG"] "]]") { found = 1 }
      END { exit(found ? 0 : 1) }' "$file"; then
    continue
  fi

  if grep -Fqx "## $section" "$file"; then
    SEC="$section" BULLET="$bullet" perl -i -pe '
      print "$ENV{BULLET}\n" if $seen and not $done and (/^## / or eof);
      $done = 1 if $seen and not $done and (/^## / or eof);
      $seen = 1 if $_ eq "## $ENV{SEC}\n";
    ' "$file"
  else
    printf '\n## %s\n%s\n' "$section" "$bullet" >> "$file"
  fi
  n=$((n + 1))
done < "$EDGES"

echo "added $n backlink bullet(s)"
