#!/usr/bin/env bash
# Create one personal note file under <repo-root>/.note/personals/.
# Body is read from stdin. Prints the written path.
#
# Usage: note-new.sh <kind> <title>
#   kind  — todo | thought | reminder | question
#   title — free text, becomes the H1 and the filename slug
set -euo pipefail

kind=${1:?usage: note-new.sh <todo|thought|reminder|question> <title>}
title=${2:?usage: note-new.sh <todo|thought|reminder|question> <title>}

case "$kind" in
  todo | thought | reminder | question) ;;
  *)
    echo "note-new.sh: kind must be todo, thought, reminder or question (got '$kind')" >&2
    exit 2
    ;;
esac

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
dir="$root/.note/personals"
mkdir -p "$dir"

slug=$(printf '%s' "$title" |
  tr '[:upper:]' '[:lower:]' |
  sed -e 's/[^a-z0-9]\{1,\}/-/g' -e 's/^-//' -e 's/-$//' |
  cut -c1-60 |
  sed -e 's/-$//')
[ -n "$slug" ] || slug=note

day=$(date +%F)
file="$dir/$day-$slug.md"
n=2
while [ -e "$file" ]; do
  file="$dir/$day-$slug-$n.md"
  n=$((n + 1))
done

repo=$(basename "$root")
branch=$(git branch --show-current 2>/dev/null || true)

{
  echo '---'
  echo "kind: $kind"
  echo "created: $(date '+%F %H:%M')"
  echo "repo: $repo"
  [ -n "$branch" ] && echo "branch: $branch"
  echo '---'
  echo
  echo "# $title"
  echo
  cat
} >"$file"

echo "$file"
