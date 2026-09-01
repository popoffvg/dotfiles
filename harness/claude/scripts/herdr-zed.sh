#!/usr/bin/env bash
# Launch herdr for the Zed agent-thread terminal and start claudex in its pane.
# Zed's agent.terminal_init_command runs this instead of claudex itself.
set -euo pipefail

CONFIG="${HERDR_ZED_CONFIG:-$HOME/.config/herdr/zed.toml}"
START_CMD="${HERDR_ZED_COMMAND:-claudex}"
WAIT_SECONDS="${HERDR_ZED_WAIT:-15}"
TITLE_POLL_SECONDS="${HERDR_ZED_TITLE_POLL:-1}"

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

# Zed names the terminal thread after the OSC title the program writes, but
# herdr parses that title into pane metadata and writes nothing outward, so the
# thread keeps whatever name it started with. Republish the focused pane's
# title — Claude Code's task summary, and whatever /rename sets — as herdr's own
# outer title, which does reach Zed.
publish_pane_title() {
  local last="" current
  export HERDR_SOCKET_PATH="$SOCKET"
  while sleep "$TITLE_POLL_SECONDS"; do
    [[ -S "$SOCKET" ]] || continue
    current=$(herdr pane current 2>/dev/null \
      | jq -r 'try .result.pane.terminal_title_stripped // empty')
    [[ -n "$current" && "$current" != "$last" ]] || continue
    herdr terminal title set "$current" >/dev/null 2>&1 && last="$current"
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

export HERDR_SESSION="$SESSION"
export HERDR_CONFIG_PATH="$CONFIG"
trap drop_session EXIT

send_start_command &

publish_pane_title &
title_watcher=$!

herdr --session "$SESSION"
