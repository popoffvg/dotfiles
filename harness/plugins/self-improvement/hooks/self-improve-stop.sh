#!/usr/bin/env bash
# Stop hook (self-improvement plugin): two branches, and only one of them costs
# a model call.
#
#   already archived -> re-sync the copy and its sidecar, then stay silent. The
#                       session was judged interesting on an earlier pass; the
#                       transcript only grows, so keeping the archive current is
#                       a byte-append, not a judgment. No subagent, no turn.
#   not archived yet -> block once, so the agent classifies the human prompts
#                       that arrived since the last pass: global behaviour,
#                       project scope, or neither. Only the first two get a copy.
#
# Breaks the Stop->respond->Stop loop via stop_hook_active.
set -euo pipefail

plugin_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
state_dir=${SELF_IMPROVE_STATE_DIR:-$HOME/.claude/self-improvement/state}

input=$(cat)
active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false')

# Already continuing because of this hook -> let the agent stop.
if [ "$active" = "true" ]; then
  exit 0
fi

transcript=$(printf '%s' "$input" | jq -r '.transcript_path // ""')
if [ -z "$transcript" ] || [ ! -f "$transcript" ]; then
  exit 0
fi

# Branch 1 — the session is already marked interesting. Sync and say nothing.
if "$plugin_root/scripts/find-archive.sh" "$transcript" >/dev/null 2>&1; then
  "$plugin_root/scripts/archive-transcript.sh" "$transcript" >/dev/null 2>&1 || true
  exit 0
fi

# Branch 2 — nothing to classify unless the user has typed since the last pass.
# The state file holds the transcript line of the last human prompt already
# checked, so a session classified as "neither" is never re-judged: it stays
# quiet until the user speaks again. It lives beside the archive, not in TMPDIR,
# because "checked, found nothing" has to outlive a reboot.
key=$(basename "$transcript" .jsonl)
state="$state_dir/$key.checked-line"
last=$(cat "$state" 2>/dev/null || echo 0)
case "$last" in (''|*[!0-9]*) last=0 ;; esac

new_last=$("$plugin_root/scripts/human-turns.sh" "$transcript" "$last" 2>/dev/null \
  | awk '/^--- line /{n=$3} END{if (n) print n}' || true)
case "$new_last" in (''|*[!0-9]*) exit 0 ;; esac

mkdir -p "$state_dir"
printf '%s' "$new_last" > "$state"

reason="This session is not archived yet. Run the capture-lesson skill on the human prompts after transcript line $last — it classifies them and archives the session under the scope it picks. Otherwise stop silently — no status text."

jq -nc --arg r "$reason" '{decision:"block", reason:$r, suppressOutput:true}'
