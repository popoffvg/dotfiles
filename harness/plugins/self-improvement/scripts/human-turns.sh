#!/usr/bin/env bash
# Print the human-typed prompts of a Claude Code transcript, newest last.
#
# A transcript is mostly tool_result traffic (7 MB / 242 `user` entries in a
# measured session, of which 5 were typed by the person). `.origin.kind ==
# "human"` is the only field that marks a real prompt: tool results carry
# `toolUseResult`, injected reminders carry `isMeta`, and both also have
# `type == "user"`.
#
# Each block is prefixed with the transcript line number so a reader can open
# the raw file at that point for surrounding context. An optional second
# argument filters to prompts after that line, so a resumed triage agent can
# re-check just the part of the transcript grown since its last pass instead
# of re-judging the whole session every time the Stop hook fires.
set -euo pipefail

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  printf 'usage: %s <transcript.jsonl> [since-line]\n' "$(basename "$0")" >&2
  exit 2
fi

transcript=$1
since_line=${2:-0}
if [ ! -f "$transcript" ]; then
  printf 'no transcript at %s\n' "$transcript" >&2
  exit 1
fi

jq -r --argjson since "$since_line" '
  select(.type == "user" and .origin.kind == "human")
  | select(input_line_number > $since)
  | "--- line \(input_line_number)  \(.timestamp // "no-timestamp")\n"
    + (if (.message.content | type) == "string"
       then .message.content
       else (.message.content | map(select(.type == "text") | .text) | join("\n"))
       end)
' "$transcript"
