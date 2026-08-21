#!/usr/bin/env bash
# Score one session and write its record. `score-session.sh <id> <transcript> <from-line>`
#
# One model call, on haiku, in this process — never in the session that triggered
# the scan. The call gets the human prompts as text in the prompt and no tools,
# so it cannot wander into the transcript, the repo, or the network: the whole
# judgment is "here are the prompts, return the JSON in the rubric".
#
# The rubric is not restated here. `references/score.md` is read into the prompt
# verbatim, so the bands the model applies and the bands a human reads are the
# same text.
#
# Two ways this exits without a model call:
#   no new prompts   the new bytes were tool traffic. seen_bytes advances so the
#                    next scan skips the file; the watermark does not move.
#   already scored   nothing to do; the caller decided that, not this script.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

if [ $# -ne 3 ]; then
  printf 'usage: %s <session-id> <transcript.jsonl> <from-line>\n' "$(basename "$0")" >&2
  exit 2
fi

id=$1
transcript=$2
from=$3

[ -f "$transcript" ] || { log "score $id: transcript gone"; exit 0; }

rubric="$plugin_root/skills/capture-lesson/references/score.md"
bytes=$(bytes_of "$transcript")

# Rewrite the record from the old one plus this pass's outcome. `score` is the
# high-water mark across passes, not the latest pass: a session that held a
# correction at line 40 is still that session after twenty ordinary prompts, and
# the scope follows whichever pass set the score.
write_record() {
  local score=$1 scope=$2 why=$3 mark=$4 archive=${5:-}
  local old='{}'
  [ -f "$(record_path "$id")" ] && old=$(cat "$(record_path "$id")")
  record_write "$id" "$(jq -n \
    --argjson old "$old" \
    --arg id "$id" --arg transcript "$transcript" --arg topic "$topic" \
    --argjson score "$score" --arg scope "$scope" --arg why "$why" \
    --argjson mark "$mark" --argjson bytes "$bytes" \
    --arg archive "$archive" --arg at "$(date -u +%FT%TZ)" --argjson from "$from" '
    ($old.score // -1) as $prev
    | ($score > $prev) as $better
    | {
        session: $id,
        transcript: $transcript,
        topic: (if $topic == "" then ($old.topic // "") else $topic end),
        watermark: $mark,
        seen_bytes: $bytes,
        score: (if $better then $score else $prev end),
        scope: (if $better then $scope else ($old.scope // "none") end),
        why: (if $better then $why else ($old.why // "") end),
        archive: (if $archive == "" then ($old.archive // null) else $archive end),
        updated: $at,
        passes: (($old.passes // []) + [{from: $from, to: $mark, score: $score, scope: $scope, why: $why, at: $at}])
      }')"
}

prompts_raw=$("$scripts_dir/human-turns.sh" "$transcript" "$from" 2>/dev/null || true)
prompts=$prompts_raw

# The watermark can only advance to a line this pass actually read. With no new
# prompt it stays put and only seen_bytes moves, so the next growth spurt is
# still measured from the last prompt judged.
#
# Exit 3, not 0, so the caller can tell "handled without spending a call" from
# "scored". Its per-scan budget is a budget of model calls, and a hundred quiet
# sessions must not exhaust it.
if [ -z "$prompts" ]; then
  topic=""
  write_record 0 none "" "$from"
  log "score $id: no new prompts, seen_bytes=$bytes"
  exit 3
fi

mark=$(printf '%s' "$prompts_raw" | awk '/^--- line /{n=$3} END{print (n ? n : 0)}')
[ "$mark" -gt "$from" ] 2>/dev/null || mark=$from

# Recorded for the reader, never sent to the model: the topic is the harness's
# own ai-title, which is written by the assistant. See below.
topic=$("$scripts_dir/session-title.sh" "$transcript" 2>/dev/null || printf '')

# What the model is given is only what the person typed. human-turns.sh already
# drops tool results, meta entries and image blocks; strip_reader_marks drops the
# line-number headers; and the ai-title above is recorded but never sent. The
# line numbers are read from the raw output first, because the watermark needs
# them.
#
# The rubric asks "would this teach a colleague?", and every non-user token in
# the prompt is a chance to answer it from something other than the user's own
# words: an ai-title summarising what the assistant thought the session was about
# is exactly the kind of hint that turns a scorer into an echo of the assistant.
prompts=$(printf '%s\n' "$prompts_raw" | strip_reader_marks)

# Keep the newest prompts when a session is enormous: the tail is where a
# correction the pass has not seen yet lives, and an unbounded prompt would make
# one pass cost more than every other pass combined.
prompt_bytes=${SELF_IMPROVE_PROMPT_BYTES:-40000}
prompts=$(printf '%s' "$prompts" | tail -c "$prompt_bytes")

read -r -d '' request <<EOF || true
$(cat "$rubric")

---

Apply the rubric above to the prompts below. They are the prompts one person
typed in one session, separated by \`---\`, in order. They are the only evidence
you get: there is no assistant turn, no tool output, and no session title here,
and you must not ask for any. Return one line of JSON and nothing else.

$prompts
EOF

# The child fires its own SessionStart hook, which would launch another scan,
# which would launch another child. The hook exits on seeing this.
export SELF_IMPROVE_CHILD=1

verdict=$(printf '%s' "$request" | claude -p \
  --model haiku \
  --disallowedTools Bash Read Edit Write Glob Grep Task WebFetch WebSearch \
  2>/dev/null | tr -d '\r' | grep -o '{.*}' | tail -n 1) || verdict=''

score=$(printf '%s' "$verdict" | jq -r 'if (.score|type) == "number" then (.score|floor) else empty end' 2>/dev/null || true)
scope=$(printf '%s' "$verdict" | jq -r '.scope // empty' 2>/dev/null || true)
why=$(printf '%s' "$verdict" | jq -r '.why // empty' 2>/dev/null || true)

case "$scope" in global|project|none) ;; *) scope=none ;; esac
case "$score" in
  ''|*[!0-9]*)
    write_record 0 none 'unparseable verdict' "$mark"
    log "score $id: unparseable verdict, watermark=$mark"
    exit 0
    ;;
esac
[ "$score" -le 10 ] || score=10

# At or above the threshold the transcript itself is copied out, because
# ~/.claude/projects is Claude Code's to prune and the evidence has to outlive
# it. archive-transcript.sh appends only the new tail on a re-score and keeps
# the scope the first archive chose, so repeat passes never fork a second copy.
archive=''
if [ "$score" -ge "$keep_score" ] && [ "$scope" != none ]; then
  archive=$("$scripts_dir/archive-transcript.sh" "$transcript" "$scope" 2>/dev/null || printf '')
fi

write_record "$score" "$scope" "$why" "$mark" "$archive"
log "score $id: score=$score scope=$scope watermark=$mark archive=${archive:-none}"

if [ -n "$archive" ]; then
  "$scripts_dir/notify.sh" "Lesson caught ($scope, $score/10)" "${why:-${topic:-$id}}"
fi
