#!/usr/bin/env bash
# Copy a session transcript into the lessons archive and print the destination.
#
# Called twice per kept lesson: once by the triage subagent (slug "session",
# an interim safety copy so the transcript survives rotation before anyone
# judges it) and once by capture-lesson, run from dream's harvest step, once
# the lesson is kept (the real case-slug, replacing the interim copy).
# Sessions that turn out not to recur get no permanent copy. The archive
# lives outside the dotfiles repo and is never committed.
#
# The triage subagent is resumed across a session, not relaunched, so it
# calls this on the same "session"-slugged dest path every time it sees a new
# correction — the source transcript only ever grows (append-only JSONL). If
# the dest already exists and is a prefix of the source (the normal case),
# append just the new tail instead of re-copying the whole file. Falls back
# to a full copy whenever that assumption doesn't hold (no dest yet, or dest
# is not a byte-for-byte prefix of source — e.g. a rotated/compacted
# transcript), so a stale or divergent dest never silently stays wrong.
set -euo pipefail

archive_dir=${SELF_IMPROVE_LESSONS_DIR:-$HOME/.claude/self-improvement/lessons}

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  printf 'usage: %s <transcript.jsonl> [slug]\n' "$(basename "$0")" >&2
  exit 2
fi

transcript=$1
slug=${2:-session}

if [ ! -f "$transcript" ]; then
  printf 'no transcript at %s\n' "$transcript" >&2
  exit 1
fi

# Keep the filename safe and stable: lowercase, only letters/digits/dashes.
slug=$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-' | sed -e 's/-\{2,\}/-/g' -e 's/^-//' -e 's/-$//')
[ -n "$slug" ] || slug=session

mkdir -p "$archive_dir"

dest="$archive_dir/$(date +%F)-$slug-$(basename "$transcript")"

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

printf '%s\n' "$dest"
