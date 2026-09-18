#!/usr/bin/env bash
# List every kept lesson — one row per archived transcript.
#
#   <score>  <status>  <scope>  <date>  <title>  <session-id>  <verdict>
#
# The archive on disk is the source of truth for what a lesson is and whether it
# is done: a transcript under `lessons/harvested/` has already become a skill,
# one under `lessons/global`, `lessons/project`, or flat in `lessons/` still
# waits for /dream. The record in `sessions/<id>.json` only decorates the row
# with the scan's score and its suggestion verdict — never with the status,
# whose `archive` field still names the pre-harvest path.
#
# Sorted by score, highest first, then newest first inside a score: the same
# order /dream works down, so the top of this list is the next thing to do.
#
#   --pending     only the unharvested lessons
#   --harvested   only the finished ones
#   --tsv         raw tab-separated rows with no header, for a caller that parses
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

want=all
tsv=no
for arg in "$@"; do
  case $arg in
    --pending) want=pending ;;
    --harvested) want=harvested ;;
    --tsv) tsv=yes ;;
    *) printf 'usage: %s [--pending|--harvested] [--tsv]\n' "$(basename "$0")" >&2; exit 2 ;;
  esac
done

[ -d "$lessons_dir" ] || exit 0

tab=$(printf '\t')

# One jq pass over the whole records dir, not one per lesson: there are as many
# records as sessions ever seen, and the join needs four of their fields. It goes
# to a file because awk joins two inputs far more simply than it splits one -v.
records_tsv=$(mktemp)
trap 'rm -f "$records_tsv"' EXIT
find "$records_dir" -type f -name '*.json' -print0 2>/dev/null \
  | xargs -0 jq -r '[.session, (.score // "-"), (.scope // "-"),
                     (.suggestion_verdict // "-"), (.topic // "")] | @tsv' 2>/dev/null \
  > "$records_tsv" || true

rows=$(
  find "$lessons_dir" -maxdepth 2 -type f -name '*.jsonl' 2>/dev/null \
    | awk -v want="$want" -F'\t' '
      NR == FNR {
        score[$1] = $2; scope[$1] = $3; verdict[$1] = $4; topic[$1] = $5
        next
      }
      {
        path = $0
        status = (path ~ /\/harvested\//) ? "harvested" : "pending"
        if (want != "all" && want != status) next

        name = path
        sub(/.*\//, "", name)
        sub(/\.jsonl$/, "", name)

        # `<date>-<title-slug>-<session-id>`: an ISO day, then the slug, then a
        # 36-character uuid. Both ends are fixed width, so the slug is what is
        # left between them.
        date = substr(name, 1, 10)
        id = substr(name, length(name) - 35)
        title = substr(name, 12, length(name) - 48)
        gsub(/-/, " ", title)
        # `session` is the slug the archiver writes when the session had no
        # ai-title yet. The topic in the record is the later, better name.
        if (title == "" || title == "session") title = topic[id]
        if (title == "") title = "(untitled)"

        print (score[id] == "" ? "-" : score[id]) "\t" status "\t" \
              (scope[id] == "" ? "-" : scope[id]) "\t" date "\t" title "\t" id "\t" \
              (verdict[id] == "" ? "-" : verdict[id])
      }' "$records_tsv" - \
    | sort -t"$tab" -k1,1rn -k4,4r
)

[ -n "$rows" ] || exit 0

if [ "$tsv" = yes ]; then
  printf '%s\n' "$rows"
else
  { printf 'SCORE\tSTATUS\tSCOPE\tDATE\tTITLE\tSESSION\tVERDICT\n'; printf '%s\n' "$rows"; } \
    | column -t -s"$tab"
fi
