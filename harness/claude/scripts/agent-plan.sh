#!/usr/bin/env bash
# agent-plan.sh — launch the `planner` agent (cocoindex-driven, no source edits).
#
# Usage:
#   agent-plan.sh                       # interactive session, current dir
#   agent-plan.sh "<prompt>"            # interactive with starter prompt
#   agent-plan.sh -p "<prompt>"         # headless one-shot, prints to stdout
#   agent-plan.sh -- <extra claude args> "<prompt>"
#
# The planner is read-only for source code; it writes only to .notes/. It needs ccc
# to be installed and the project initialized (it will run `ccc init`/`ccc index`
# itself if needed).

set -euo pipefail

PRINT=0
ARGS=()
while (("$#")); do
  case "$1" in
    -p|--print) PRINT=1; shift ;;
    --) shift; ARGS+=("$@"); break ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *) ARGS+=("$1"); shift ;;
  esac
done

cmd=(claude --agent planner --permission-mode acceptEdits)
if (( PRINT )); then
  cmd+=(-p)
fi

exec "${cmd[@]}" "${ARGS[@]}"
