#!/usr/bin/env bash
set -uo pipefail

usage() {
  cat <<'EOF'
watch-answers.sh <file> [--settle SECONDS] [--poll SECONDS] [--max-diff LINES]

Emit one report every time the operator saves a review file and stops typing.
Built for the Monitor tool: each report is one notification, and the watch ends
itself when every **Answer:** slot is filled.

  --settle    quiet seconds after a save that mean "they stopped typing" (default 3)
  --poll      mtime poll interval (default 0.5)
  --max-diff  truncate a report's diff past this many lines (default 120)

Each report is the output of answers-since.sh: status, answered: N/M,
quiet-ticks, and the unified diff since the report before it.
Exits 0 on `status: DONE`, or when the file is gone for 30s.
EOF
}

[[ $# -ge 1 ]] || { usage; exit 2; }

file=""; settle=3; poll=0.5; max_diff=120
while [[ $# -gt 0 ]]; do
  case "$1" in
    --settle) settle="$2"; shift 2 ;;
    --poll) poll="$2"; shift 2 ;;
    --max-diff) max_diff="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "unknown argument: $1" >&2; exit 2 ;;
    *) file="$1"; shift ;;
  esac
done

[[ -n "$file" && -f "$file" ]] || { echo "no such file: $file" >&2; exit 2; }

since="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/answers-since.sh"
[[ -x "$since" ]] || { echo "missing $since" >&2; exit 2; }

mtime() { stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null || echo gone; }

"$since" "$file" --reset >/dev/null

settle_ticks="$(awk -v s="$settle" -v p="$poll" 'BEGIN{t=s/p; print (t<1?1:int(t+0.5))}')"
gone_limit="$(awk -v p="$poll" 'BEGIN{t=30/p; print (t<1?1:int(t+0.5))}')"

last="$(mtime)"
gone_for=0

while true; do
  sleep "$poll"
  now="$(mtime)"

  if [[ "$now" == "gone" ]]; then
    gone_for=$((gone_for + 1))
    if [[ "$gone_for" -gt "$gone_limit" ]]; then
      echo "watch ended: $file is gone"
      exit 0
    fi
    continue
  fi
  gone_for=0

  [[ "$now" == "$last" ]] && continue

  quiet=0
  while [[ "$quiet" -lt "$settle_ticks" ]]; do
    sleep "$poll"
    probe="$(mtime)"
    if [[ "$probe" == "$now" ]]; then
      quiet=$((quiet + 1))
    else
      now="$probe"; quiet=0
    fi
  done
  last="$now"

  report="$("$since" "$file" 2>&1)"
  printf '%s\n' "$report" | awk -v max="$max_diff" '
    NR <= max { print; next }
    NR == max + 1 { print "… diff truncated at " max " lines — run answers-since.sh for the rest" }
  '

  case "$report" in
    *"status: DONE"*) echo "watch ended: every slot answered"; exit 0 ;;
  esac
done
