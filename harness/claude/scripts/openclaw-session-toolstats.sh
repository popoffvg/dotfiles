#!/usr/bin/env bash
# Tool-call statistics for pi/piscord agent sessions on the openclaw server.
# Usage:
#   openclaw-session-toolstats.sh [--host openclaw] [--root <sessions-dir>] [--since <YYYY-MM-DD>] [--top N]
#   openclaw-session-toolstats.sh --bash-commands [...]   # list bash command strings instead of counts
set -euo pipefail

HOST=openclaw
ROOT='$HOME/.local/share/piscord-gateway/sessions'
SINCE=""
TOP=30
MODE=counts

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="$2"; shift 2 ;;
    --root) ROOT="$2"; shift 2 ;;
    --since) SINCE="$2"; shift 2 ;;
    --top) TOP="$2"; shift 2 ;;
    --bash-commands) MODE=bash; shift ;;
    --bash-verbs) MODE=verbs; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

remote_counts() {
cat <<'EOS'
find ROOT_PLACEHOLDER -name '*.jsonl' -newermt 'SINCE_PLACEHOLDER' -print0 2>/dev/null |
xargs -0 -r cat |
jq -r 'select(.type=="message") | .message.content[]? | select(.type=="toolCall" or .type=="tool_use" or .type=="tool_call") | (.name // .toolName // "unknown")' |
sort | uniq -c | sort -rn
EOS
}

remote_bash() {
cat <<'EOS'
find ROOT_PLACEHOLDER -name '*.jsonl' -newermt 'SINCE_PLACEHOLDER' -print0 2>/dev/null |
xargs -0 -r cat |
jq -r 'select(.type=="message") | .message.content[]? | select((.name // .toolName // "") | test("^(bash|Bash)$")) | (.args.command // .input.command // .arguments.command // "?")' |
head -c 200000
EOS
}

# Histogram of the first executable word of each bash command.
remote_verbs() {
cat <<'EOS'
find ROOT_PLACEHOLDER -name '*.jsonl' -newermt 'SINCE_PLACEHOLDER' -print0 2>/dev/null |
xargs -0 -r cat |
jq -r 'select(.type=="message") | .message.content[]? | select((.name // .toolName // "") | test("^(bash|Bash)$")) | (.args.command // .input.command // .arguments.command // "?") | split("\n")[0] | ltrimstr(" ") | split(" ")[0]' |
sort | uniq -c | sort -rn
EOS
}

[[ -z "$SINCE" ]] && SINCE="1970-01-01"

case "$MODE" in
  counts) SCRIPT="$(remote_counts)" ;;
  verbs)  SCRIPT="$(remote_verbs)" ;;
  bash)   SCRIPT="$(remote_bash)" ;;
esac
SCRIPT="${SCRIPT//ROOT_PLACEHOLDER/$ROOT}"
SCRIPT="${SCRIPT//SINCE_PLACEHOLDER/$SINCE}"

ssh "$HOST" "$SCRIPT" | head -n "$TOP"
