#!/usr/bin/env bash
# Stop hook (self-improvement plugin): prompt the agent once to capture a
# generalizable behavioral rule from a user correction into a skill.
# Breaks the Stop->respond->Stop loop via stop_hook_active.
set -euo pipefail

input=$(cat)
active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false')

# Already continuing because of this hook -> let the agent stop.
if [ "$active" = "true" ]; then
  exit 0
fi

reason='If the user corrected your behavior in a generalizable way this session, run the capture-lesson skill to write it into a new or existing skill. Otherwise stop silently — no status text.'

jq -nc --arg r "$reason" '{decision:"block", reason:$r, suppressOutput:true}'
