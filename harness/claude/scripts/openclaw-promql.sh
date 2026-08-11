#!/usr/bin/env bash
# Query the otel-lgtm Prometheus inside the openclaw container, read-only.
# Usage: openclaw-promql.sh '<promql>' [instant|range] [start] [end] [step]
set -euo pipefail

query=${1:?promql required}
mode=${2:-instant}

case "$mode" in
  instant)
    ssh openclaw "docker exec otel-lgtm curl -s --get 'http://127.0.0.1:9090/api/v1/query' \
      --data-urlencode 'query=$query'"
    ;;
  range)
    start=${3:?start required}
    end=${4:?end required}
    step=${5:?step required}
    ssh openclaw "docker exec otel-lgtm curl -s --get 'http://127.0.0.1:9090/api/v1/query_range' \
      --data-urlencode 'query=$query' --data-urlencode 'start=$start' \
      --data-urlencode 'end=$end' --data-urlencode 'step=$step'"
    ;;
  *)
    echo "unknown mode: $mode" >&2
    exit 2
    ;;
esac
