#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
answers-since.sh <file> [--reset]

One tick of a review-file watch. Prints what the operator changed since the last
call and how many Answer slots are still empty, then re-snapshots the file.
Returns at once — it never waits. Call it once per /loop tick.

  --reset   drop the stored snapshot and re-arm on this call

Output:
  file: <path>
  status: ARMED | NEW | QUIET | DONE
  answered: <filled>/<total>      (total 0 = prose file, no slots)
  quiet-ticks: <n>                (consecutive ticks with no change)
  then the unified diff since the last tick, when there is one.

Status meanings:
  ARMED  first call — baseline stored, nothing to read yet
  NEW    the file changed — the diff below is what the operator wrote
  QUIET  no change since the last tick
  DONE   every Answer slot is filled
EOF
}

[[ $# -ge 1 ]] || { usage; exit 2; }

file=""; reset=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset) reset=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "unknown argument: $1" >&2; exit 2 ;;
    *) file="$1"; shift ;;
  esac
done

[[ -n "$file" && -f "$file" ]] || { echo "no such file: $file" >&2; exit 2; }

abs="$(cd "$(dirname "$file")" && pwd)/$(basename "$file")"
key="$(printf '%s' "$abs" | shasum | cut -c1-16)"
state_dir="${CLAUDE_STATE_DIR:-$HOME/.claude/state}/answers-since/$key"
snap="$state_dir/snap"
quiet_file="$state_dir/quiet"

mkdir -p "$state_dir"
[[ "$reset" -eq 1 ]] && rm -f "$snap" "$quiet_file"

count_slots() {
  awk '
    /^\*\*Answer:\*\*/ {
      total++
      rest = $0
      sub(/^\*\*Answer:\*\*[ \t]*/, "", rest)
      if (rest != "") { filled++; pending = 0; next }
      pending = 1
      next
    }
    pending && /^(---|###|## )/ { pending = 0 }
    pending && NF { filled++; pending = 0 }
    END { printf "%d %d\n", filled + 0, total + 0 }
  ' "$file"
}

read -r filled total <<<"$(count_slots)"

echo "file: $abs"

if [[ ! -f "$snap" ]]; then
  cp "$file" "$snap"
  echo 0 > "$quiet_file"
  echo "status: ARMED"
  echo "answered: $filled/$total"
  echo "quiet-ticks: 0"
  exit 0
fi

quiet="$(cat "$quiet_file" 2>/dev/null || echo 0)"

if diff -q "$snap" "$file" >/dev/null; then
  quiet=$((quiet + 1))
  echo "$quiet" > "$quiet_file"
  changed=0
else
  quiet=0
  echo 0 > "$quiet_file"
  changed=1
fi

if [[ "$total" -gt 0 && "$filled" -eq "$total" ]]; then
  echo "status: DONE"
elif [[ "$changed" -eq 1 ]]; then
  echo "status: NEW"
else
  echo "status: QUIET"
fi

echo "answered: $filled/$total"
echo "quiet-ticks: $quiet"

if [[ "$changed" -eq 1 ]]; then
  echo
  diff -u --label "last tick" --label "now" "$snap" "$file" || true
  cp "$file" "$snap"
fi
