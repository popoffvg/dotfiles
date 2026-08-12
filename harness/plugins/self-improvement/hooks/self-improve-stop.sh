#!/usr/bin/env bash
# Stop hook (self-improvement plugin): two branches, and only one of them costs
# a model call.
#
#   already archived -> re-sync the copy and its sidecar, then stay silent. The
#                       session was judged interesting on an earlier pass; the
#                       transcript only grows, so keeping the archive current is
#                       a byte-append, not a judgment. No subagent, no turn.
#   not archived yet -> spawn a detached `claude -p` on haiku to classify the
#                       human prompts that arrived since the last pass: global
#                       behaviour, project scope, or neither. Only the first two
#                       get a copy. That pass only classifies and archives — it
#                       never writes a skill. Extraction happens later, in
#                       batch, in a /dream pass.
#
# Neither branch blocks, so this hook costs the calling session no turn and no
# tokens. The user hears about a pass only when it catches something, as a
# desktop notification from the detached process.
set -euo pipefail

# Inside the detached triage session, whose own Stop would spawn another one.
[ -n "${SELF_IMPROVE_TRIAGE:-}" ] && exit 0

plugin_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
state_dir=${SELF_IMPROVE_STATE_DIR:-$HOME/.claude/self-improvement/state}

transcript=$(jq -r '.transcript_path // ""')
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

# nohup + background, because macOS has no setsid. The pass takes tens of
# seconds and the turn must not wait on it. All three fds are redirected: an
# inherited stdout would be read back as this hook's output, and an inherited
# stdin would steal the hook's payload.
nohup "$plugin_root/scripts/triage-detached.sh" "$transcript" "$last" \
  </dev/null >/dev/null 2>&1 &
disown 2>/dev/null || true
exit 0
