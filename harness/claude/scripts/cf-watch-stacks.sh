#!/usr/bin/env bash
set -uo pipefail

usage() {
  cat <<'EOF'
Emit one line per CloudFormation stack status CHANGE, then exit once every
stack named has reached a terminal status. Built as a Monitor event source:
one stdout line per event, nothing while a stack sits unchanged.

  cf-watch-stacks.sh --region REGION [--interval SEC] STACK...

Env: AWS_PROFILE is honoured as usual.

Terminal statuses cover failure as well as success, so a rollback or a delete
is reported rather than looking like "still running":
  CREATE_COMPLETE  UPDATE_COMPLETE  DELETE_COMPLETE  CREATE_FAILED
  ROLLBACK_COMPLETE  ROLLBACK_FAILED  DELETE_FAILED
  UPDATE_ROLLBACK_COMPLETE  UPDATE_ROLLBACK_FAILED

On a failed status the first CREATE_FAILED reason that is not a bare
"Resource creation cancelled" is appended, since that noise is collateral
from whichever resource actually failed.
EOF
}

REGION=
INTERVAL=60
STACKS=()

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)  usage; exit 0 ;;
    --region)   REGION=$2; shift 2 ;;
    --interval) INTERVAL=$2; shift 2 ;;
    -*)         echo "unknown flag: $1" >&2; exit 2 ;;
    *)          STACKS+=("$1"); shift ;;
  esac
done

[[ -n $REGION ]]        || { echo "--region is required" >&2; exit 2; }
[[ ${#STACKS[@]} -gt 0 ]] || { echo "name at least one stack" >&2; exit 2; }

is_terminal() {
  case $1 in
    CREATE_COMPLETE|UPDATE_COMPLETE|DELETE_COMPLETE|CREATE_FAILED|\
ROLLBACK_COMPLETE|ROLLBACK_FAILED|DELETE_FAILED|\
UPDATE_ROLLBACK_COMPLETE|UPDATE_ROLLBACK_FAILED) return 0 ;;
    *) return 1 ;;
  esac
}

failure_reason() {
  aws cloudformation describe-stack-events --region "$REGION" --stack-name "$1" \
    --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].[LogicalResourceId,ResourceStatusReason]' \
    --output text 2>/dev/null \
    | grep -v "Resource creation cancelled" | head -1
}

declare -A seen=()
remaining=${#STACKS[@]}

while [[ $remaining -gt 0 ]]; do
  for s in "${STACKS[@]}"; do
    [[ ${seen[$s]:-} == TERMINAL ]] && continue
    st=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$s" \
           --query 'Stacks[0].StackStatus' --output text 2>/dev/null) || st=""
    [[ -z $st ]] && continue
    if [[ ${seen[$s]:-} != "$st" ]]; then
      if is_terminal "$st"; then
        if [[ $st == *FAILED* || $st == *ROLLBACK* ]]; then
          echo "$s -> $st  |  $(failure_reason "$s")"
        else
          echo "$s -> $st"
        fi
        seen[$s]=TERMINAL
        remaining=$((remaining - 1))
        continue
      fi
      echo "$s -> $st"
      seen[$s]=$st
    fi
  done
  [[ $remaining -gt 0 ]] && sleep "$INTERVAL"
done

echo "all ${#STACKS[@]} stacks reached a terminal status"
