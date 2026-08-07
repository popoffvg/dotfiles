#!/usr/bin/env bash
# Structural verification for /dive docs research artifacts.
#
# Checks each <slug>.md in a research dir for the mechanical failures an LLM
# critic is bad at and a script is good at:
#   1. markdown tables broken by a blank line mid-table
#   2. DP-N / EC-N / RR-N numbering gaps or duplicates
#   3. code links pointing at a missing file or a line past end-of-file
#   4. missing mandatory sections
#   5. unresolvable link prefixes (bare repo-root paths)
#
# Usage:
#   verify-dive-artifacts.sh <research-dir> [<file>...]
#
# Exit 0 = all clean. Exit 1 = at least one problem found.

set -o nounset
set -o pipefail

RESEARCH_DIR="${1:-}"
if [[ -z "$RESEARCH_DIR" || ! -d "$RESEARCH_DIR" ]]; then
  echo "usage: $(basename "$0") <research-dir> [<file>...]" >&2
  exit 2
fi
shift || true

cd "$RESEARCH_DIR" || exit 2

if [[ $# -gt 0 ]]; then
  FILES=("$@")
else
  # Portable (BSD/macOS + GNU): glob, then filter. No find -printf.
  FILES=()
  for f in *.md; do
    [[ -f "$f" ]] || continue
    case "$f" in
      *.questions.md | INDEX.md | _*) continue ;;
    esac
    FILES+=("$f")
  done
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "ERROR: no artifacts to check in $RESEARCH_DIR" >&2
  echo "(an empty file set is a failure, not a pass)" >&2
  exit 2
fi

MANDATORY=(
  "## Terms"
  "## Intent (tests)"
  "## TL;DR"
  "## 1."
  "## 2."
  "## 5."
  "## 6."
  "## 7."
  "## Grill answers"
  "## Trace"
)

PROBLEMS=0

note() { printf '  %-9s %s\n' "$1" "$2"; PROBLEMS=$((PROBLEMS + 1)); }

# Contiguity check for a numbered marker family (DP / EC / RR).
#
# Only counts numbers this document DEFINES — a table row starting "| DP-3"
# or a bold heading "**DP-3". A bare inline "DP-9" is usually a cross-reference
# to a sibling artifact's numbering and must not be treated as a local
# definition, or every cross-doc reference invents phantom gaps.
check_numbering() {
  local file="$1" prefix="$2"
  local nums max i
  nums=$(grep -oE "(^\| *|\*\*)${prefix}-[0-9]+" "$file" \
         | grep -oE "${prefix}-[0-9]+" | sed "s/${prefix}-//" | sort -n -u)
  [[ -z "$nums" ]] && return 0
  max=$(echo "$nums" | tail -1)
  for ((i = 1; i <= max; i++)); do
    if ! echo "$nums" | grep -qx "$i"; then
      note "NUMBERING" "${prefix}-${i} missing (highest is ${prefix}-${max})"
    fi
  done
  # A definition line should exist once per number, not twice.
  local dup
  dup=$(grep -o "^| ${prefix}-[0-9]\+" "$file" | sort | uniq -d)
  [[ -n "$dup" ]] && note "NUMBERING" "duplicate definition rows: $(echo "$dup" | tr '\n' ' ')"
  return 0
}

# A blank line between two table rows silently ends the table in markdown.
check_tables() {
  local file="$1"
  awk '
    /^\|/ { if (blank_after_row) { print NR ": blank line splits table" ; blank_after_row=0 } ; in_row=1 ; next }
    /^[[:space:]]*$/ { if (in_row) blank_after_row=1 ; in_row=0 ; next }
    { in_row=0 ; blank_after_row=0 }
  ' "$file" | while read -r hit; do
    note "TABLE" "$hit"
  done
}

# Every ](../../vendor/...:NNN) must point at a real file and a real line.
check_links() {
  local file="$1"
  local bad_target=0 bad_line=0 checked=0
  while IFS= read -r link; do
    local path line target
    path="${link%%:*}"
    line="${link##*:}"
    [[ "$path" == "$line" ]] && line=""
    target="$path"
    if [[ ! -f "$target" ]]; then
      bad_target=$((bad_target + 1))
      note "LINK" "missing file: $path"
      continue
    fi
    checked=$((checked + 1))
    if [[ -n "$line" && "$line" =~ ^[0-9]+$ ]]; then
      local eof
      # grep -c '' counts lines even when the file lacks a trailing newline;
      # `wc -l` counts newline characters and reports 0 for a one-line file
      # with no final newline, producing false "past EOF" reports.
      eof=$(grep -c '' "$target" | tr -d ' ')
      if ((line > eof)); then
        bad_line=$((bad_line + 1))
        note "LINK" "$path:$line past EOF (file has $eof lines)"
      fi
    fi
  done < <(grep -o '](\.\./\.\./vendor/[^)]*)' "$file" \
           | sed 's/^](//; s/)$//' | sed 's/-[0-9]*$//' | sort -u)
  printf '  %-9s %s\n' "LINKS" "$checked unique targets resolved, $bad_target missing, $bad_line past-EOF"
}

check_prefixes() {
  local file="$1" n
  n=$(grep -cE '\]\((antifold|test|data|output|models)/' "$file")
  ((n > 0)) && note "PREFIX" "$n bare repo-root links (unresolvable from this dir)"
  return 0
}

check_sections() {
  local file="$1" s
  for s in "${MANDATORY[@]}"; do
    grep -qF "$s" "$file" || note "SECTION" "missing: $s"
  done
}

for f in "${FILES[@]}"; do
  echo "=== $f ==="
  check_sections "$f"
  check_tables "$f"
  check_numbering "$f" DP
  check_numbering "$f" EC
  check_numbering "$f" RR
  check_prefixes "$f"
  check_links "$f"
done

echo
if ((PROBLEMS == 0)); then
  echo "CLEAN — no structural problems in ${#FILES[@]} artifact(s)"
  exit 0
fi
echo "$PROBLEMS problem(s) found across ${#FILES[@]} artifact(s)"
exit 1
