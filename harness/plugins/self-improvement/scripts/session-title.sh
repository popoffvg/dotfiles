#!/usr/bin/env bash
# Print the session's topic — the last `ai-title` entry the harness wrote.
#
# Prints an empty line when the transcript carries no title yet (a short session
# gets one late, or never). Callers decide the fallback: archive-transcript.sh
# slugs it into a filename, session-env.sh states its absence in the sidecar.
set -euo pipefail

if [ $# -ne 1 ]; then
  printf 'usage: %s <transcript.jsonl>\n' "$(basename "$0")" >&2
  exit 2
fi

transcript=$1
if [ ! -f "$transcript" ]; then
  printf 'no transcript at %s\n' "$transcript" >&2
  exit 1
fi

jq -rs '[.[] | select(.type == "ai-title") | .aiTitle] | last // ""' "$transcript"
