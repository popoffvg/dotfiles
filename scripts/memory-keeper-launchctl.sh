#!/usr/bin/env bash
set -euo pipefail

LABEL="com.popoffvg.memory-keeper"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
SERVICE="gui/$(id -u)/${LABEL}"
OUT_LOG="$HOME/.claude/debug/memory-keeper-launchd.out.log"
ERR_LOG="$HOME/.claude/debug/memory-keeper-launchd.err.log"

cmd="${1:-status}"

case "$cmd" in
  load)
    launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    launchctl kickstart -k "$SERVICE"
    ;;

  unload)
    launchctl bootout "gui/$(id -u)" "$PLIST"
    ;;

  restart)
    launchctl kickstart -k "$SERVICE"
    ;;

  status)
    launchctl print "$SERVICE"
    ;;

  logs)
    echo "==> $OUT_LOG"
    [[ -f "$OUT_LOG" ]] && tail -n 80 "$OUT_LOG" || echo "(missing)"
    echo
    echo "==> $ERR_LOG"
    [[ -f "$ERR_LOG" ]] && tail -n 80 "$ERR_LOG" || echo "(missing)"
    ;;

  *)
    echo "Usage: $0 {load|unload|restart|status|logs}" >&2
    exit 2
    ;;
esac
