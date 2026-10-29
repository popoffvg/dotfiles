#!/usr/bin/env bash
# PostToolUse (Edit|Write|Bash): move each live ADR whose last changelog line starts with
# "Superseded by [ADR-NNNN]" or "Deprecated:" to <notes-dir>/adr/archived/, same file name.
# The status key (proposed | approved) is not a trigger: the changelog line is the only one.
# Registered on Bash too: the changelog edit is often a perl or sed one-liner, and the sweep is idempotent.
# Never blocks the tool call. Prints what moved and the live files that still link to it.
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null) || exit 0
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null) || exit 0

adr=""
case "$FILE_PATH" in
  */adr/*) adr="${FILE_PATH%/adr/*}/adr" ;;
esac

if [[ -z "$adr" && -n "$CWD" && -d "$CWD" ]]; then
  dir="$CWD"
  while :; do
    [[ -d "$dir/.notes/adr" ]] && { adr="$dir/.notes/adr"; break; }
    parent=$(dirname "$dir")
    [[ "$parent" == "$dir" ]] && break
    dir="$parent"
  done
fi

[[ -n "$adr" && -d "$adr" ]] || exit 0

candidates=$(grep -l -E '^- [0-9]{4}-[0-9]{2}-[0-9]{2} — (Superseded by|Deprecated:)' "$adr"/[0-9]*.md 2>/dev/null) || exit 0
[[ -n "$candidates" ]] || exit 0

notes_dir=$(dirname "$adr")
archived="$adr/archived"

# "superseded-by-NNNN", "deprecated", or nothing: read from the last line of ## Changelog.
last_change() {
  awk '/^## / { inlog = ($0 == "## Changelog"); next }
       inlog && /^- [0-9]{4}-[0-9]{2}-[0-9]{2} — / { last = $0 }
       END {
         sub(/^- [0-9-]+ — /, "", last)
         if (last ~ /^Superseded by \[?ADR-[0-9]{4}/) { match(last, /[0-9]{4}/); print "superseded-by-" substr(last, RSTART, 4) }
         else if (last ~ /^Deprecated:/) print "deprecated"
       }' "$1"
}

# Files outside adr/archived/ with a markdown link whose target ends in <base> and is not under archived/.
linkers() {
  local base="$1" f hits
  hits=$(grep -rlF --include='*.md' "$base" "$notes_dir" 2>/dev/null | grep -v "/adr/archived/") || return 0
  while IFS= read -r f; do
    if grep -oE "\]\([^)]*$base" "$f" | grep -qv "archived/$base"; then
      printf '%s ' "${f#"$notes_dir"/}"
    fi
  done <<<"$hits"
}

move() {
  if git -C "$adr" ls-files --error-unmatch "$1" >/dev/null 2>&1; then
    git -C "$adr" mv "$1" "$2"
  else
    mv "$1" "$2"
  fi
}

report=""
while IFS= read -r file; do
  [[ -f "$file" ]] || continue
  status=$(last_change "$file")
  case "$status" in
    deprecated | superseded-by-[0-9][0-9][0-9][0-9]) ;;
    *) continue ;;
  esac

  base=$(basename "$file")
  mkdir -p "$archived"
  if [[ -e "$archived/$base" ]]; then
    report="${report}  ! $base: archived/ already has a file with this name. It stays live. Resolve it by hand."$'\n'
    continue
  fi
  move "$file" "$archived/$base" || continue
  report="${report}  $base ($status)"$'\n'

  if [[ "$status" == superseded-by-* ]]; then
    next="${status#superseded-by-}"
    compgen -G "$adr/$next-*.md" >/dev/null || \
      report="${report}    ! no live ADR $next-*.md in ${adr#"$notes_dir"/}/. Write the new ADR, or fix the changelog line."$'\n'
  fi

  still=$(linkers "$base")
  [[ -z "$still" ]] || \
    report="${report}    ! still linked from: ${still% }. Point each link at archived/$base or at the ADR that replaces it."$'\n'
done <<<"$candidates"

[[ -n "$report" ]] || exit 0

printf 'wm: ADR archive sweep into %s/\n%s' "${archived#"$notes_dir"/}" "$report"
exit 0
