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

# Deterministic prefilter: a correction needs the user reacting to the agent's
# work, so it takes at least 2 user text messages. A discovery instead leaves a
# doc-reading trace (web/docs tool calls). Sessions with neither almost never
# hold a lesson -- skip the capture prompt instead of spending a turn.
transcript=$(printf '%s' "$input" | jq -r '.transcript_path // ""')
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  n=$(jq -s '[ .[]
        | select(.type == "user" and ((.isMeta // false) | not))
        | .message.content
        | if type == "string" then 1 else ([.[]? | select(.type == "text")] | length) end
        | select(. > 0) ] | length' "$transcript" 2>/dev/null || echo 2)
  case "$n" in (''|*[!0-9]*) n=2 ;; esac
  docs=$(jq -s '[ .[]
        | select(.type == "assistant")
        | .message.content[]?
        | select(.type == "tool_use")
        | .name
        | select(test("WebFetch|WebSearch|firecrawl"; "i")) ] | length' "$transcript" 2>/dev/null || echo 1)
  case "$docs" in (''|*[!0-9]*) docs=1 ;; esac
  if [ "$n" -lt 2 ] && [ "$docs" -eq 0 ]; then
    exit 0
  fi

  # The prefilter above is session-wide, so once a long session passes it, it
  # passes at every single stop -- the same capture prompt re-fires for the rest
  # of the session, each re-fire costing a full-context turn. Block at most once
  # per human turn: remember the human-message count at the last block and stay
  # quiet until the user has spoken again.
  state_dir="${TMPDIR:-/tmp}"
  key=$(basename "$transcript" .jsonl)
  state="$state_dir/self-improve-stop-$key.human-turns"
  last=$(cat "$state" 2>/dev/null || echo 0)
  case "$last" in (''|*[!0-9]*) last=0 ;; esac
  if [ "$n" -le "$last" ]; then
    exit 0
  fi
  printf '%s' "$n" > "$state"
fi

reason='If the user corrected you, said how they want a task done or how work is done in this repo, or you learned something non-obvious from docs or experiments this session, run the capture-lesson skill — it decides what counts and where the lesson goes. Otherwise stop silently — no status text.'

jq -nc --arg r "$reason" '{decision:"block", reason:$r, suppressOutput:true}'
