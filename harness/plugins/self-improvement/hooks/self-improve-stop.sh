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

reason='If this session contains a generalizable lesson, run the capture-lesson skill to write it into a new or existing skill. Two sources count: (a) the user corrected your behavior; (b) the user stated how they want a task done — the order, shape, or tool to use — even though nothing had gone wrong. Otherwise stop silently — no status text.'

jq -nc --arg r "$reason" '{decision:"block", reason:$r, suppressOutput:true}'
