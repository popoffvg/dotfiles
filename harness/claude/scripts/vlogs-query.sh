#!/usr/bin/env bash
# Query VictoriaLogs (LogsQL) through a local port-forward.
#
# Usage: vlogs-query.sh <logsql-query> [limit] [start] [end]
#   start/end accept VictoriaLogs time syntax (e.g. 6h, 2026-08-18T12:00:00Z).
#   Defaults: limit=100, start=24h, end=now.
#
# Requires an active port-forward to VictoriaLogs on $VLOGS_PORT (default 9428):
#   kubectl port-forward -n monitoring svc/victoria-logs-victoria-logs-single-server 9428:9428
# 127.0.0.1 is outside the command sandbox — run with the sandbox off.
set -euo pipefail

query="${1:?usage: vlogs-query.sh <logsql-query> [limit] [start] [end]}"
limit="${2:-100}"
start="${3:-24h}"
end="${4:-now}"
port="${VLOGS_PORT:-9428}"

curl -sG "http://localhost:${port}/select/logsql/query" \
  --data-urlencode "query=${query}" \
  --data-urlencode "limit=${limit}" \
  --data-urlencode "start=${start}" \
  --data-urlencode "end=${end}"
