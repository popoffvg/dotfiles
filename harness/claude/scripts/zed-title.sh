#!/usr/bin/env bash
# Write "<state mark> <session name>" as the terminal title while one claude process runs.
# Zed names the agent thread after this title. zed-claude starts this script and sets
# CLAUDE_CODE_DISABLE_TERMINAL_TITLE, so Claude Code does not write over it.
set -uo pipefail

if (($# != 4)); then
  echo "usage: ${0##*/} <state-file> <title-file> <claude-pid> <tty>" >&2
  exit 2
fi
STATE_FILE=$1 TITLE_FILE=$2 CLAUDE_PID=$3 TTY_PATH=$4

POLL_SECONDS="1"
QUESTION_MARK="?"
WAIT_MARK="⧗"
DONE_MARK="◉"
UNTAGGED_MARK="○"
BUSY_FRAMES=(◰ ◳ ◲ ◱)

trap 'rm -f "$STATE_FILE" "$TITLE_FILE"' EXIT

transcript_title() {
  local name
  name=$(grep -a -o "\"$1\":\"[^\"]*\"" "$2" 2>/dev/null | tail -1)
  name=${name#*:\"}
  printf '%s' "${name%\"}"
}

# The switch above also stops the aiTitle, so hooks/auto-title.py writes TITLE_FILE.
# A /rename title wins; an aiTitle remains only in sessions started before the switch.
session_name() {
  local name
  name=$(transcript_title customTitle "$1")
  [[ -n $name ]] || name=$(cat "$TITLE_FILE" 2>/dev/null)
  [[ -n $name ]] || name=$(transcript_title aiTitle "$1")
  printf '%s' "$name"
}

frame=0 last=""
while kill -0 "$CLAUDE_PID" 2>/dev/null; do
  sleep "$POLL_SECONDS"
  [[ -r $STATE_FILE ]] || continue
  IFS=$'\x1f' read -r state transcript < <(jq -r '[.state // "", .transcript // ""] | join("\u001f")' "$STATE_FILE" 2>/dev/null) || continue
  name=$(session_name "$transcript")
  [[ -n $name ]] || continue
  case $state in
  working)
    mark=${BUSY_FRAMES[frame]}
    frame=$(((frame + 1) % ${#BUSY_FRAMES[@]}))
    ;;
  question | permission) mark=$QUESTION_MARK frame=0 ;;
  wait) mark=$WAIT_MARK frame=0 ;;
  done) mark=$DONE_MARK frame=0 ;;
  *) mark=$UNTAGGED_MARK frame=0 ;;
  esac
  title="$mark $name"
  [[ $title != "$last" ]] || continue
  printf '\033]0;%s\007' "$title" >>"$TTY_PATH" 2>/dev/null && last=$title
done
