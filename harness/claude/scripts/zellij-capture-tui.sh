#!/usr/bin/env bash
# Drive a TUI binary inside a detached zellij session, dumping the screen after
# each scripted keystroke. Produces text "screenshots" of every step.
#
# Usage: zellij-capture-tui.sh <binary> <outdir>
# The keystroke script is the STEPS array below (edit per target TUI).
#
# Key bytes: enter=13 ; down=27 91 66 ; up=27 91 65
set -euo pipefail

BIN="${1:?binary path}"
OUT="${2:?output dir}"
SESSION="tuicap-$$"
COLS="${COLS:-100}"
ROWS="${ROWS:-40}"

mkdir -p "$OUT"
rm -f "$OUT"/*.txt 2>/dev/null || true

# zellij needs a pty; `script` gives it one. macOS BSD script: `script -q out cmd`.
# Start detached in background, sized via stty inside the pty.
script -q /dev/null bash -c "stty cols $COLS rows $ROWS; PLATFORMA_TUI_DRYRUN=1 zellij -s $SESSION --layout /dev/stdin <<'KDL'
layout {
  pane command=\"$BIN\"
}
KDL
" >/dev/null 2>&1 &
ZPID=$!

cleanup() { zellij -s "$SESSION" kill-session 2>/dev/null || true; kill "$ZPID" 2>/dev/null || true; }
trap cleanup EXIT

# Wait for the session to come up.
for _ in $(seq 1 30); do
  zellij list-sessions 2>/dev/null | grep -q "$SESSION" && break
  sleep 0.3
done
sleep 1.5  # let the TUI paint its first frame

n=0
dump() { zellij -s "$SESSION" action dump-screen "$OUT/$(printf '%02d' "$n")-$1.txt"; n=$((n+1)); sleep 0.5; }
send() { zellij -s "$SESSION" action write "$@"; sleep 0.6; }
type() { zellij -s "$SESSION" action write-chars "$1"; sleep 0.4; }
ENTER="13"; DOWN="27 91 66"

dump welcome
send $ENTER;            dump project
type "my-lab-platforma"; send $ENTER; dump deployment-name
send $ENTER;            dump region            # default name accepted
send $DOWN; send $ENTER; dump size             # pick us-central1
send $ENTER;            dump domain            # keep Small
type "mylab.bio";       send $ENTER; dump dns-zone-name
type "mylab-bio";       send $ENTER; dump subdomain
type "platforma";       send $ENTER; dump license
type "E-DEMO-KEY";      send $ENTER; dump contact-email
type "ops@mylab.bio";   send $ENTER; dump auth-method
send $ENTER;            dump demo              # htpasswd
send $ENTER;            dump review            # include demo
echo "captured $n frames to $OUT"
