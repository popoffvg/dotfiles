#!/usr/bin/env bash
# Per-session prompt stack. One file per entry (multiline-safe).
# Usage: store.sh push <text> | pop [n] | list | drop
set -euo pipefail

session="${CLAUDE_CODE_SESSION_ID:-default}"
dir="${TMPDIR:-/tmp}/claude-prompt-store/${session}"
mkdir -p "$dir"

# entries sorted by push order (filename = zero-padded counter)
entries() { find "$dir" -maxdepth 1 -name '*.txt' 2>/dev/null | sort; }

case "${1:-}" in
  push)
    shift
    text="$*"
    [ -z "$text" ] && { echo "nothing to push (empty prompt)"; exit 0; }
    last=$(entries | tail -1)
    prev=0; [ -n "$last" ] && prev=$((10#$(basename "$last" .txt)))
    n=$(printf '%04d' $((prev + 1)))
    printf '%s' "$text" > "$dir/$n.txt"
    echo "pushed #$(entries | wc -l | tr -d ' '): ${text:0:60}"
    ;;
  pop)
    idx="${2:-}"
    mapfile -t files < <(entries)
    [ "${#files[@]}" -eq 0 ] && { echo "store empty"; exit 0; }
    if [ -n "$idx" ]; then
      f="${files[$((idx-1))]:-}"
      [ -z "$f" ] && { echo "no entry #$idx"; exit 1; }
    else
      f="${files[-1]}"
    fi
    cat "$f"
    rm -f "$f"
    ;;
  list)
    mapfile -t files < <(entries)
    [ "${#files[@]}" -eq 0 ] && { echo "store empty"; exit 0; }
    i=1
    for f in "${files[@]}"; do
      first=$(head -1 "$f")
      printf '%d. %s\n' "$i" "${first:0:80}"
      i=$((i+1))
    done
    ;;
  drop)
    rm -f "$dir"/*.txt 2>/dev/null || true
    echo "store cleared"
    ;;
  *)
    echo "usage: store.sh push <text> | pop [n] | list | drop" >&2
    exit 2
    ;;
esac
