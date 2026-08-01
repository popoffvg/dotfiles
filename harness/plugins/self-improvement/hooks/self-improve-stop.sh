#!/usr/bin/env bash
# Stop hook (self-improvement plugin): prompt the agent once to run
# capture-lesson. What counts as a lesson and where it lands live in the skill.
# Breaks the Stop->respond->Stop loop via stop_hook_active.
set -euo pipefail

input=$(cat)
active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false')

# Already continuing because of this hook -> let the agent stop.
if [ "$active" = "true" ]; then
  exit 0
fi

reason='If the user corrected you, said how they want a task done, or said how work is done in this repo, run the capture-lesson skill — it decides what counts and where the lesson goes. Otherwise stop silently — no status text.'

jq -nc --arg r "$reason" '{decision:"block", reason:$r, suppressOutput:true}'
