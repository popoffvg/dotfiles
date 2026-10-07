#!/usr/bin/env bash
# Launch herdr for the Zed agent-thread terminal and start claudex in its pane.
# Zed's agent.terminal_init_command runs this instead of claudex itself.
set -euo pipefail

CONFIG="${HERDR_ZED_CONFIG:-$HOME/.config/herdr/zed.toml}"
START_CMD="${HERDR_ZED_COMMAND:-claudex}"
WAIT_SECONDS="${HERDR_ZED_WAIT:-15}"
TITLE_POLL_SECONDS="${HERDR_ZED_TITLE_POLL:-1}"
DONE_ICON="${HERDR_ZED_DONE_ICON:-○}"
QUESTION_ICON="${HERDR_ZED_QUESTION_ICON:-△}"
WAIT_ICON="${HERDR_ZED_WAIT_ICON:-⧗}"
read -r -a BUSY_FRAMES <<<"${HERDR_ZED_BUSY_FRAMES:-◰ ◳ ◲ ◱}"

if [[ ! -r "$CONFIG" ]]; then
  echo "herdr-zed: no config at $CONFIG" >&2
  exit 1
fi

SESSIONS_DIR="$HOME/.config/herdr/sessions"

# macOS caps a unix socket path at 103 characters, and herdr binds its longest
# one at <sessions-dir>/<session>/herdr-server.sock. A directory named after a
# long branch pushes past the cap, the server can never bind, and the client
# gives up with "server did not become ready within 15s".
LONGEST_SOCKET="/herdr-server.sock"
name_budget=$((103 - ${#SESSIONS_DIR} - 1 - ${#LONGEST_SOCKET}))

# A fresh session per launch. The pid keeps the name unique, so two terminals
# never share panes and never race for a socket.
slug=$(basename "$PWD" | tr -c 'A-Za-z0-9_-' '-' | sed 's/-\{2,\}/-/g; s/^-//; s/-$//')
slug=${slug:-default}
slug_budget=$((name_budget - 4 - 1 - ${#$}))
if ((slug_budget < 1)); then slug_budget=1; fi
slug=${slug:0:slug_budget}
SESSION="${HERDR_ZED_SESSION:-zed-${slug%-}-$$}"

# Every herdr command needs the socket of THIS session. The CLI reads
# HERDR_SOCKET_PATH alone — it ignores HERDR_SESSION, and with no socket named
# it answers from the default session, so `pane run` would type into whatever
# pane the operator has focused over there.
SOCKET="$SESSIONS_DIR/$SESSION/herdr.sock"

# herdr holds the terminal, so the first command has to be sent from outside it.
# The socket file appears only once the session is up.
send_start_command() {
  local deadline=$((SECONDS + WAIT_SECONDS)) pane
  export HERDR_SOCKET_PATH="$SOCKET"
  while ((SECONDS < deadline)); do
    [[ -S "$SOCKET" ]] || { sleep 0.2; continue; }
    pane=$(herdr pane list 2>/dev/null \
      | jq -r 'try (.result.panes[] | select(.focused) | .pane_id) // empty' \
      | head -1)
    if [[ -n "$pane" ]]; then
      herdr pane run "$pane" "$START_CMD" >/dev/null
      return 0
    fi
    sleep 0.2
  done
  echo "herdr-zed: no pane appeared in ${WAIT_SECONDS}s" >&2
  return 1
}

# Claude Code marks its own state with a glyph in front of the title, and herdr
# strips only the ones it knows — the circle set (U+25D0 and its neighbours)
# reaches `terminal_title_stripped` and reads as a second icon beside this one,
# so the jq filter below cuts every glyph Claude Code can write. Read
# `agent_status` for the state instead: herdr tracks it per pane, and it
# separates blocked (Claude waits on the operator) from idle.
#
# The rotation is counted here rather than mirrored off Claude Code's own 960ms
# flip, because sampling that clock on this one aliases into a stutter.
#
# The mark at rest comes from the `triage` token that herdr-turn-triage.py sets
# at each Stop from the tag the session model writes at the end of its reply.
#
# Writes to $styled, because a command substitution would run this in a subshell
# and throw away the frame counter.
frame=0
restyle_icon() {
  if [[ -z $3 ]]; then
    styled=""
    return
  fi
  local state=$1
  if [[ $state == idle || $state == done ]]; then state=${2:-done}; fi
  case $state in
  working)
    printf -v styled "%s %s" "${BUSY_FRAMES[frame]}" "$3"
    frame=$(((frame + 1) % ${#BUSY_FRAMES[@]}))
    return
    ;;
  blocked | question) printf -v styled "%s %s" "$QUESTION_ICON" "$3" ;;
  wait) printf -v styled "%s %s" "$WAIT_ICON" "$3" ;;
  done) printf -v styled "%s %s" "$DONE_ICON" "$3" ;;
  *) styled=$3 ;;
  esac
  frame=0
}

# Zed names the terminal thread after the OSC title the program writes, but
# herdr parses that title into pane metadata and writes nothing outward, so the
# thread keeps whatever name it started with. Republish the focused pane's
# title — Claude Code's task summary, and whatever /rename sets — as herdr's own
# outer title, which does reach Zed.
publish_pane_title() {
  local last="" status="" triage="" name=""
  export HERDR_SOCKET_PATH="$SOCKET"
  while sleep "$TITLE_POLL_SECONDS"; do
    if [[ ! -S "$SOCKET" ]]; then
      [[ -z ${WATCH_ONLY:-} ]] || return 0
      continue
    fi
    # A herdr call that answers nothing leaves read at EOF, and its non-zero exit
    # would take the whole watcher down under `set -e` — one transient failure
    # would freeze the icon for the rest of the session. Swallow it and skip the
    # tick instead; read has already blanked every field. The separator is U+001F, not a tab:
    # read merges runs of a whitespace separator, so an empty token would shift the title.
    IFS=$'\x1f' read -r status triage name < <(herdr pane current 2>/dev/null |
      jq -r 'try ([.result.pane.agent_status // "", (.result.pane.tokens.triage // ""),
        (.result.pane.terminal_title_stripped // ""
          | sub("^[\\x{2733}\\x{273B}\\x{23FA}\\x{25CB}\\x{25CF}\\x{25C9}\\x{25CE}\\x{25EF}\\x{25D0}-\\x{25D3}\\x{2800}-\\x{28FF}\\s]+"; ""))] | join("\u001f"))') || true
    restyle_icon "$status" "$triage" "$name"
    [[ -n "$styled" && "$styled" != "$last" ]] || continue
    herdr terminal title set "$styled" >/dev/null 2>&1 && last="$styled"
  done
}

# Nothing reattaches to this session, so leaving it behind would only grow
# ~/.config/herdr/sessions. Drop it however herdr exits.
drop_session() {
  if [[ -n "${title_watcher:-}" ]]; then
    kill "$title_watcher" 2>/dev/null || true
  fi
  HERDR_SOCKET_PATH="$SOCKET" herdr session stop "$SESSION" >/dev/null 2>&1 || true
  HERDR_SOCKET_PATH="$SOCKET" herdr session delete "$SESSION" >/dev/null 2>&1 || true
}

# `herdr-zed.sh watch-title <socket>` runs only the title watcher for a live session
# and stops when the session socket goes away. It restarts the watcher after an
# edit to this file, because a running loop keeps the code it started with.
if [[ ${1:-} == watch-title ]]; then
  SOCKET=$2 WATCH_ONLY=1
  publish_pane_title
  exit 0
fi

export HERDR_SESSION="$SESSION"
export HERDR_CONFIG_PATH="$CONFIG"
trap drop_session EXIT

send_start_command &

publish_pane_title &
title_watcher=$!

herdr --session "$SESSION"
