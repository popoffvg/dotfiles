#!/usr/bin/env bash
# Stop hook (self-improvement plugin): hand the "did a correction happen?"
# judgment to a cheap haiku subagent instead of making the main agent read its
# own session back. The subagent only flags interest and archives the
# transcript — it does not extract lessons or write skills. That extraction
# happens later, in batch, in a /dream pass, so nothing in this session needs
# the verdict: the subagent runs in the background and the user is never
# blocked waiting on it.
# Breaks the Stop->respond->Stop loop via stop_hook_active.
set -euo pipefail

input=$(cat)
active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false')

# Already continuing because of this hook -> let the agent stop.
if [ "$active" = "true" ]; then
  exit 0
fi

transcript=$(printf '%s' "$input" | jq -r '.transcript_path // ""')

# No transcript to triage -> nothing to judge, stop silently.
if [ -z "$transcript" ] || [ ! -f "$transcript" ]; then
  exit 0
fi

# CLAUDE_PLUGIN_ROOT is not guaranteed in the hook process; derive it.
plugin_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# Stop fires on every turn, so re-launching a fresh subagent each time is
# wasteful — reuse the same one across the session via its stable name.
session_id=$(basename "$transcript" .jsonl)
agent_name="triage-${session_id}"

# Stop can fire many times back-to-back with no human input between them
# (each SendMessage round-trip ends a turn, which is itself a Stop). Without
# a cooldown that fires the block+SendMessage dance on every single one of
# those, one after another. Debounce: skip silently if the last trigger was
# under a minute ago.
cooldown_file="/tmp/self-improve-triage-${session_id}.cooldown"
cooldown_secs=60
now=$(date +%s)
last=0
[ -f "$cooldown_file" ] && last=$(cat "$cooldown_file" 2>/dev/null || echo 0)
if [ $(((now - last))) -lt "$cooldown_secs" ]; then
  exit 0
fi
printf '%s' "$now" > "$cooldown_file"

reason="SendMessage to \"$agent_name\" (plugin root $plugin_root, transcript $transcript, re-check for a new correction); if that agent doesn't exist yet, launch it instead via Agent tool with subagent_type \"self-improvement:triage\", name \"$agent_name\", run_in_background true, same plugin root/transcript. Then stop silently — no waiting, no report, no capture-lesson."

jq -nc --arg r "$reason" '{decision:"block", reason:$r, suppressOutput:true}'
