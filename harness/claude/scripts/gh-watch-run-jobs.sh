#!/usr/bin/env bash
set -uo pipefail

usage() {
  cat <<'EOF'
Emit one line per job status CHANGE in a GitHub Actions run, then exit when the
run reaches a terminal state. Built as a Monitor event source: one stdout line
per event, silence while nothing moves.

  gh-watch-run-jobs.sh --repo OWNER/REPO --run RUN_ID [--interval SEC]
                       [--only REGEX] [--deadline SEC]

  --only REGEX   report only jobs whose name matches (the run's own completion
                 is always reported)
  --deadline SEC give up waiting and exit 2 (default 3600)

A finished job reports its conclusion, and a failed one also names its first
failed step -- a job that reports only "completed" cannot be acted on.
EOF
}

REPO=
RUN=
INTERVAL=30
ONLY=
DEADLINE=3600

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)   usage; exit 0 ;;
    --repo)      REPO=$2; shift 2 ;;
    --run)       RUN=$2; shift 2 ;;
    --interval)  INTERVAL=$2; shift 2 ;;
    --only)      ONLY=$2; shift 2 ;;
    --deadline)  DEADLINE=$2; shift 2 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

[[ -n $REPO && -n $RUN ]] || { echo "--repo and --run are required" >&2; exit 2; }

declare -A seen=()
waited=0

failed_step() {
  gh run view "$RUN" --repo "$REPO" --json jobs \
    --jq "[.jobs[] | select(.name==\"$1\") | .steps[] | select(.conclusion==\"failure\") | .name] | .[0] // empty" \
    2>/dev/null
}

while [[ $waited -lt $DEADLINE ]]; do
  snapshot=$(gh run view "$RUN" --repo "$REPO" --json status,conclusion,jobs 2>/dev/null)
  if [[ -z $snapshot ]]; then
    sleep "$INTERVAL"; waited=$((waited + INTERVAL)); continue
  fi

  while IFS=$'\t' read -r name status conclusion; do
    [[ -z $name ]] && continue
    [[ -n $ONLY && ! $name =~ $ONLY ]] && continue
    state="$status/${conclusion:--}"
    if [[ ${seen[$name]:-} != "$state" ]]; then
      seen[$name]=$state
      if [[ $conclusion == failure ]]; then
        step=$(failed_step "$name")
        echo "job '$name' -> FAILURE${step:+  (failed step: $step)}"
      else
        echo "job '$name' -> $state"
      fi
    fi
  done < <(jq -r '.jobs[] | [.name, .status, (.conclusion // "")] | @tsv' <<<"$snapshot")

  run_status=$(jq -r '.status' <<<"$snapshot")
  if [[ $run_status == completed ]]; then
    echo "run $RUN completed: $(jq -r '.conclusion' <<<"$snapshot")"
    exit 0
  fi

  sleep "$INTERVAL"; waited=$((waited + INTERVAL))
done

echo "run $RUN still not complete after ${DEADLINE}s"
exit 2
