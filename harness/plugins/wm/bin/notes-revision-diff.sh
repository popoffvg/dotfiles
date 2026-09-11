#!/usr/bin/env bash
# What changed in the notes since the last revision.
#
# The notes dir is a standalone jj repo and every `revise` run commits with a
# message starting `revise` (arch:sub-revise.md Step 4). That commit is the
# before-state: diffing it against the working copy names the stale artifacts
# without reading any of them.
#
#   notes-revision-diff.sh [TODO-N] [--full] [--log] [--from <revset>] [-- <path>...]
#
# Exit: 0 diff printed (or nothing changed) · 2 no matching revision
#       3 no notes jj repo, or jj absent.
#
# Tool index — every .notes tool and its flags: wm:TOOLS.md
set -euo pipefail

# The header comment IS the usage text — read it back rather than restate it, so
# the two cannot drift. A line range would break the moment the header moves.
usage() {
  sed -e '1d' -e '/^[^#]/,$d' -e 's/^# \{0,1\}//' "$0"
}

lib="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/notes-store.sh"
# shellcheck source=notes-store.sh
source "$lib"

todo=""
from=""
full=0
showlog=0
paths=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --full) full=1; shift ;;
    --log)  showlog=1; shift ;;
    --from) from="${2:-}"; [[ -z "$from" ]] && { usage >&2; exit 3; }; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    --) shift; paths+=("$@"); break ;;
    TODO-*) todo="$1"; shift ;;
    -*) echo "notes-revision-diff: unknown option $1" >&2; usage >&2; exit 3 ;;
    *)  paths+=("$1"); shift ;;
  esac
done

command -v jj >/dev/null 2>&1 || {
  echo "notes-revision-diff: jj is not installed — no notes history to read" >&2
  exit 3
}

notes=$(notes_find_dir "$PWD") || {
  echo "notes-revision-diff: no .notes/.jj found from $PWD upward" >&2
  exit 3
}
# jj resolves both the printed paths and any given path against the CWD, so from
# the project root every path reads `.notes/spec.md` and a `todos` argument
# escapes the repo. Run from inside the notes dir: paths in and out are then the
# artifact names the spec corpus uses.
cd "$notes"

if [[ -n "$from" ]]; then
  revset="$from"
else
  # jj string patterns match EXACTLY unless prefixed — description("revise")
  # finds nothing. glob: is what makes the prefix match work.
  pattern="revise*"
  [[ -n "$todo" ]] && pattern="revise $todo*"
  revset="latest(description(glob:\"$pattern\"))"
fi

base=$(jj log --no-graph -r "$revset" -T 'change_id.short()' 2>/dev/null) || base=""
if [[ -z "$base" ]]; then
  {
    echo "notes-revision-diff: no commit in $notes matches"
    echo "  revset: $revset"
    if [[ -z "$from" ]]; then
      echo "  A revision is found by its message prefix, so revise must commit as"
      echo "  \"revise TODO-N: <ideas>\" (arch:sub-revise.md Step 4)."
    fi
  } >&2
  exit 2
fi

subject=$(jj log --no-graph -r "$revset" -T 'description.first_line()' 2>/dev/null || true)

echo "notes: $notes"
echo "since: $base \"$subject\""
echo

if [[ "$showlog" -eq 1 ]]; then
  echo "commits since:"
  # The working copy carries no description until it is committed; label it so
  # the list never shows a bare id on an empty line.
  jj log --no-graph -r "$base..@" \
    -T '"  " ++ change_id.short() ++ " " ++ if(description, description.first_line(), "(uncommitted working copy)") ++ "\n"' || true
  echo
fi

args=(diff --from "$base" --to '@')
[[ "$full" -eq 0 ]] && args+=(--stat)
# root: makes each path repo-relative, so `todos` means the notes' todos dir.
for p in "${paths[@]+"${paths[@]}"}"; do args+=("root:$p"); done

# --stat prints a "0 files changed" footer even when nothing moved, so ask the
# summary — an empty one is the real "nothing to revise" answer.
summary=$(jj "${args[@]/--stat/--summary}" 2>&1) || {
  echo "$summary" >&2
  exit 3
}
if [[ -z "${summary//[[:space:]]/}" ]]; then
  echo "no changes since $base"
  exit 0
fi
jj "${args[@]}"
exit 0
