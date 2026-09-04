#!/usr/bin/env bash
# Watch a GitHub PR's checks until none are pending, emitting each newly-terminal
# check as one line. Tolerates `gh pr checks` exiting non-zero while checks are
# still pending (it exits 8 in that case), which naive `|| echo '[]'` fallbacks
# swallow into a false "no failures" result.
#
# Usage: gh-pr-checks-watch.sh <pr-number> [poll-seconds] [max-polls]
set -uo pipefail

pr="${1:?usage: gh-pr-checks-watch.sh <pr-number> [poll-seconds] [max-polls]}"
interval="${2:-30}"
max="${3:-80}"

prev=""
n=0
while [ "$n" -lt "$max" ]; do
  raw="$(gh pr checks "$pr" --json name,bucket 2>/dev/null)"   # exit code is NOT a validity signal
  if ! jq -e 'type=="array" and length>0' <<<"$raw" >/dev/null 2>&1; then
    echo "WARN: could not read checks for PR $pr (attempt $((n+1)))"
    sleep "$interval"; n=$((n+1)); continue
  fi

  cur="$(jq -r '.[]|select(.bucket!="pending")|"\(.bucket|ascii_upcase): \(.name)"' <<<"$raw" | sort)"
  comm -13 <(printf '%s\n' "$prev") <(printf '%s\n' "$cur")
  prev="$cur"

  if [ "$(jq -r '[.[]|select(.bucket=="pending")]|length' <<<"$raw")" = "0" ]; then
    printf 'ALL TERMINAL — pass=%s fail=%s skip=%s\n' \
      "$(jq -r '[.[]|select(.bucket=="pass")]|length' <<<"$raw")" \
      "$(jq -r '[.[]|select(.bucket=="fail")]|length' <<<"$raw")" \
      "$(jq -r '[.[]|select(.bucket=="skipping")]|length' <<<"$raw")"
    exit 0
  fi
  sleep "$interval"; n=$((n+1))
done
echo "TIMEOUT: checks still pending after $((max*interval))s"
exit 1
