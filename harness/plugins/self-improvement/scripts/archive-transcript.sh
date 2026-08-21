#!/usr/bin/env bash
# Copy a session transcript into the lessons archive and print the destination.
#
# The archive is keyed on scope, decided once on the first pass:
#   lessons/global/   a correction to behaviour that transfers past this repo
#   lessons/project/  a method or convention tied to the repos in context
# Sessions with neither get no copy at all. The archive lives outside the
# dotfiles repo and is never committed.
#
# Two callers, two shapes:
#   new session      score-session.sh passed the threshold and hands the scope
#                    its model call chose.
#   archived session a later pass on the same session, which only re-syncs;
#                    find-archive.sh locates the existing copy, so the scope
#                    picked on the first pass is never re-judged and a
#                    re-scored session never forks a second copy.
#
# The source transcript only ever grows (append-only JSONL). If the dest already
# exists and is a prefix of the source (the normal case), append just the new
# tail instead of re-copying the whole file. Falls back to a full copy whenever
# that assumption doesn't hold (no dest yet, or dest is not a byte-for-byte
# prefix of source — e.g. a rotated/compacted transcript), so a stale or
# divergent dest never silently stays wrong.
#
# The filename slug comes from the session's own ai-title, so no caller has to
# invent one and re-syncs cannot drift onto a second name.
#
# Each copy gets a `<dest>.env.md` sidecar from session-env.sh: the session's
# topic and the git repos that were in context. It is rewritten on every call
# because both grow as the session does — a repo entered late would be missing
# from a sidecar written on the first correction.
set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

script_dir=$scripts_dir
archive_dir=$lessons_dir

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  printf 'usage: %s <transcript.jsonl> [global|project]\n' "$(basename "$0")" >&2
  printf '  scope is required for a session that is not archived yet\n' >&2
  exit 2
fi

transcript=$1
scope=${2:-}

if [ ! -f "$transcript" ]; then
  printf 'no transcript at %s\n' "$transcript" >&2
  exit 1
fi

# Keep the filename safe and stable: lowercase, only letters/digits/dashes.
slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | tr -c 'a-z0-9-' '-' \
    | sed -e 's/-\{2,\}/-/g' -e 's/^-//' -e 's/-$//'
}

if dest=$("$script_dir/find-archive.sh" "$transcript" 2>/dev/null); then
  : # re-sync into the copy this session already has, whatever its scope
else
  case "$scope" in
    global|project) ;;
    *)
      printf 'scope must be global or project for a new archive\n' >&2
      exit 2
      ;;
  esac
  slug=$(slugify "$("$script_dir/session-title.sh" "$transcript")")
  [ -n "$slug" ] || slug=session
  mkdir -p "$archive_dir/$scope"
  dest="$archive_dir/$scope/$(date +%F)-$slug-$(basename "$transcript")"
fi

dest_size=0
if [ -f "$dest" ]; then
  dest_size=$(wc -c < "$dest" | tr -d ' ')
fi
src_size=$(wc -c < "$transcript" | tr -d ' ')

if [ "$dest_size" -gt 0 ] && [ "$src_size" -ge "$dest_size" ] \
  && cmp -s <(head -c "$dest_size" "$transcript") "$dest"; then
  # dest is a byte-for-byte prefix of the (grown) source: append just the tail.
  tail -c +"$((dest_size + 1))" "$transcript" >> "$dest"
else
  cp "$transcript" "$dest"
fi

"$script_dir/session-env.sh" "$transcript" > "$dest.env.md"

printf '%s\n' "$dest"
