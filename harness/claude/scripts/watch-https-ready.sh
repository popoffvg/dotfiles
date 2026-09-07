#!/usr/bin/env bash
set -uo pipefail

usage() {
  cat <<'EOF'
Emit one line the first time each host resolves, and one when it first answers
over HTTPS. Exits once every host has answered, or when the deadline passes.
Built as a Monitor event source: one stdout line per event, silence while a
host is unchanged.

  watch-https-ready.sh [--interval SEC] [--deadline SEC] [--path P] HOST...

Why this exists: a CloudFormation stack reaching CREATE_COMPLETE does not mean
the app serves. The load balancer still has to provision and external-dns has
to publish the record, both after the stack is "done". Resolving plus a real
HTTP status is the readiness signal; stack status is not.

Any HTTP status counts as answered, including 401/403 — an auth-gated app
refusing an anonymous request has proved it is serving.
EOF
}

INTERVAL=30
DEADLINE=1800
PATH_SUFFIX=/
HOSTS=()

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)   usage; exit 0 ;;
    --interval)  INTERVAL=$2; shift 2 ;;
    --deadline)  DEADLINE=$2; shift 2 ;;
    --path)      PATH_SUFFIX=$2; shift 2 ;;
    -*)          echo "unknown flag: $1" >&2; exit 2 ;;
    *)           HOSTS+=("$1"); shift ;;
  esac
done

[[ ${#HOSTS[@]} -gt 0 ]] || { echo "name at least one host" >&2; exit 2; }

declare -A resolved=() answered=()
remaining=${#HOSTS[@]}
waited=0

while [[ $remaining -gt 0 && $waited -lt $DEADLINE ]]; do
  for h in "${HOSTS[@]}"; do
    [[ -n ${answered[$h]:-} ]] && continue

    ip=$(dig +short +time=3 +tries=1 "$h" @8.8.8.8 2>/dev/null | grep -E '^[0-9]' | head -1)
    if [[ -z $ip ]]; then continue; fi
    if [[ -z ${resolved[$h]:-} ]]; then
      resolved[$h]=$ip
      echo "$h resolves -> $ip (waiting for HTTPS)"
    fi

    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
             "https://${h}${PATH_SUFFIX}" 2>/dev/null)
    if [[ -n $code && $code != 000 ]]; then
      answered[$h]=$code
      echo "$h READY -> http $code"
      remaining=$((remaining - 1))
    fi
  done
  if [[ $remaining -gt 0 ]]; then
    sleep "$INTERVAL"
    waited=$((waited + INTERVAL))
  fi
done

if [[ $remaining -gt 0 ]]; then
  for h in "${HOSTS[@]}"; do
    [[ -z ${answered[$h]:-} ]] && \
      echo "$h STILL NOT READY after ${DEADLINE}s (resolved=${resolved[$h]:-no})"
  done
  exit 1
fi
echo "all ${#HOSTS[@]} hosts answering over HTTPS"
