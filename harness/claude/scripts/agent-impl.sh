#!/usr/bin/env bash
# agent-impl.sh — launch the `implementer` agent (git add/commit denied).
#
# Usage:
#   agent-impl.sh                       # interactive session, current dir
#   agent-impl.sh "<prompt>"            # interactive with starter prompt
#   agent-impl.sh -p "<prompt>"         # headless one-shot, prints to stdout
#   agent-impl.sh -- <extra claude args> "<prompt>"
#
# Hard rules (enforced by .claude/settings.json + agent prompt):
#   - cannot run `git add`, `git commit`, `git stage` (or amend)
#   - read-only git is fine (status/diff/log/show/blame)

set -euo pipefail

PRINT=0
ARGS=()
while (("$#")); do
  case "$1" in
    -p|--print) PRINT=1; shift ;;
    --) shift; ARGS+=("$@"); break ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *) ARGS+=("$1"); shift ;;
  esac
done

cmd=(python3 "$HOME/.claude/harness/effort.py" claude medium -- claude --agent implementer --permission-mode acceptEdits)
if (( PRINT )); then
  cmd+=(-p)
fi

exec "${cmd[@]}" "${ARGS[@]}"
