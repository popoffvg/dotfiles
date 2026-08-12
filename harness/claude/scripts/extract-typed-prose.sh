#!/usr/bin/env bash
# Extract human-typed English prose from ~/.claude/history.jsonl for a recent window.
# Machine text is dropped: slash/bang commands, command blocks, pasted bodies,
# paste markers, and anything too short to carry syntax.
set -euo pipefail

DAYS="${1:-7}"
OUT="${2:-/dev/stdout}"
HIST="${HIST_FILE:-$HOME/.claude/history.jsonl}"
MIN_CHARS="${MIN_CHARS:-40}"

[ -f "$HIST" ] || { echo "no history file: $HIST" >&2; exit 1; }

cutoff_ms=$(( ( $(date +%s) - DAYS * 86400 ) * 1000 ))

jq -r --argjson cutoff "$cutoff_ms" --argjson min "$MIN_CHARS" '
  select(.timestamp >= $cutoff)
  | .display
  | select(type == "string")
  # drop paste markers; the pasted body lives in pastedContents and is never emitted
  | gsub("\\[Pasted text #[0-9]+ \\+[0-9]+ lines\\]"; "")
  | gsub("^\\s+|\\s+$"; "")
  | select(startswith("/") | not)
  | select(startswith("!") | not)
  | select(test("<command-name>|<local-command|<system-reminder>") | not)
  # a turn with no space is a path, a flag, or an identifier, not a sentence
  | select(test(" "))
  | select(length >= $min)
  | . + "\n----"
' "$HIST" > "$OUT"

if [ "$OUT" != "/dev/stdout" ]; then
  records=$(grep -c '^----$' "$OUT" || true)
  words=$(wc -w < "$OUT")
  echo "records=$records words=$words days=$DAYS out=$OUT" >&2
fi
