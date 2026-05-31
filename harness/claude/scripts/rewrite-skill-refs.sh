#!/usr/bin/env bash
# Rewrite skill-name references in markdown/code, ONLY in delimited forms so prose
# words (e.g. "commit", "verify") are never touched:
#   `OLD`         -> `NEW`     (backtick-quoted)
#   skills/OLD/   -> skills/NEW/   (path segment)
#   @OLD          -> @NEW      (skill mention, word-bounded)
# Idempotent. Usage: rewrite-skill-refs.sh <old:new> [<old:new> ...] -- <file> [<file> ...]
set -euo pipefail

pairs=()
while [ "${1:-}" != "--" ] && [ "$#" -gt 0 ]; do pairs+=("$1"); shift; done
[ "${1:-}" = "--" ] && shift
[ "$#" -ge 1 ] || { echo "usage: rewrite-skill-refs.sh <old:new>... -- <file>..." >&2; exit 1; }

for f in "$@"; do
  [ -f "$f" ] || continue
  for pair in "${pairs[@]}"; do
    old="${pair%%:*}"; new="${pair##*:}"
    perl -i -pe "s/\`\\Q${old}\\E\`/\`${new}\`/g; s{skills/\\Q${old}\\E/}{skills/${new}/}g; s/\\@\\Q${old}\\E(?![\\w-])/\@${new}/g" "$f"
  done
  echo "rewrote: $f"
done
