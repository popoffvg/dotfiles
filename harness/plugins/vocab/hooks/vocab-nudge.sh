#!/usr/bin/env bash
# UserPromptSubmit hook (vocab plugin).
#
# First message of a session: force the deferred vocab_* tools to load, so the
# agent can reach the index without discovering it by accident.
#
# Later messages: remind the agent to file what it read, at most once every
# VOCAB_NUDGE_INTERVAL_SECS. The index is stdio-only and in-memory, so this hook
# cannot ask the server when the last vocab_put happened — it is a plain timer,
# not a "you forgot" check.
#
# No `set -e`: a non-zero exit or non-JSON stdout from a UserPromptSubmit hook
# blocks the user's message. Every path here must print JSON and exit 0.

INTERVAL="${VOCAB_NUDGE_INTERVAL_SECS:-900}"
STATE_DIR="${TMPDIR:-/tmp}"

input=$(cat)

# Pure-bash session_id parse. Avoids forking jq on every prompt submission, and
# keeps the hook working when jq is missing.
session_id=""
if [[ "$input" =~ \"session_id\"[[:space:]]*:[[:space:]]*\"([^\"]*)\" ]]; then
  session_id="${BASH_REMATCH[1]}"
fi
if [[ -z "$session_id" ]]; then
  session_id="pid-$$"
fi

# Strip anything that is not filename-safe out of the state key.
safe_session=""
for (( i = 0; i < ${#session_id}; i++ )); do
  char="${session_id:i:1}"
  if [[ "$char" == [a-zA-Z0-9_-] ]]; then
    safe_session+="$char"
  else
    safe_session+="_"
  fi
done

loaded_marker="${STATE_DIR}/vocab-${safe_session}-loaded"
nudge_marker="${STATE_DIR}/vocab-${safe_session}-nudged"

now=$(date +%s 2>/dev/null) || now=""
if [[ -z "$now" ]]; then
  printf '%s\n' '{}'
  exit 0
fi

if [[ ! -f "$loaded_marker" ]]; then
  : >"$loaded_marker" 2>/dev/null || true
  # Start the nudge clock now, so the first reminder lands one full interval
  # into the session rather than on the second message.
  printf '%s\n' "$now" >"$nudge_marker" 2>/dev/null || true

  printf '%s\n' '{"systemMessage":"FIRST ACTION — load the vocabulary tools before responding:\nselect:mcp__vocab__vocab_lookup,mcp__vocab__vocab_put,mcp__vocab__vocab_list,mcp__vocab__vocab_drop\n\nThe vocabulary is a topic index: one topic points at the one file that carries its truth. It starts EMPTY this session. vocab_lookup before writing a fact anywhere; vocab_put after reading a file."}'
  exit 0
fi

last_nudge=""
if [[ -f "$nudge_marker" ]]; then
  # `|| true`, not `|| last_nudge=""`: read assigns the value it got even when it
  # returns non-zero on a marker with no trailing newline.
  read -r last_nudge <"$nudge_marker" 2>/dev/null || true
fi
# A corrupt or non-numeric marker counts as "never nudged".
case "$last_nudge" in
  '' | *[!0-9]*) last_nudge="" ;;
esac

if [[ -n "$last_nudge" ]] && (( now - last_nudge < INTERVAL )); then
  printf '%s\n' '{}'
  exit 0
fi

printf '%s' "$now" >"$nudge_marker" 2>/dev/null || true
printf '%s\n' '{"systemMessage":"VOCABULARY REMINDER: call vocab_put for every file you read since the last check — name the topic each file is the truth for. Then vocab_lookup before you write any fact into a new place. If vocab_put warns that one file carries several topics, split it."}'
exit 0
