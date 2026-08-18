#!/usr/bin/env bash
# Collect Go pprof profiles from a Platforma pod whose debug API binds to 127.0.0.1.
# The sampler runs INSIDE the pod (port-forward cannot reach a loopback-bound debug
# port), then the whole result directory is copied out with `kubectl cp`.
#
# Usage:
#   pl-pprof-collect.sh --context hz --namespace platforma-app --out ./profiles \
#                       [--pod NAME] [--duration 300] [--interval 60] \
#                       [--trace-seconds 5] [--debug-port 9091]
#
# Repeated goroutine + heap snapshots make a leak visible as a growth curve.

set -euo pipefail

CONTEXT=""
NAMESPACE="platforma-app"
POD=""
OUT=""
DURATION=300
INTERVAL=60
TRACE_SECONDS=5
DEBUG_PORT=9091
POD_DIR="/tmp/pl-pprof"

die() { echo "pl-pprof-collect: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --context)       CONTEXT="$2"; shift 2 ;;
        --namespace|-n)  NAMESPACE="$2"; shift 2 ;;
        --pod)           POD="$2"; shift 2 ;;
        --out|-o)        OUT="$2"; shift 2 ;;
        --duration)      DURATION="$2"; shift 2 ;;
        --interval)      INTERVAL="$2"; shift 2 ;;
        --trace-seconds) TRACE_SECONDS="$2"; shift 2 ;;
        --debug-port)    DEBUG_PORT="$2"; shift 2 ;;
        --collect-only)  COLLECT_ONLY=1; shift ;;
        -h|--help)       sed -n '2,12p' "$0"; exit 0 ;;
        *)               die "unknown argument: $1" ;;
    esac
done

[ -n "$OUT" ] || die "--out is required"

KUBECTL=(kubectl)
[ -n "$CONTEXT" ] && KUBECTL+=(--context "$CONTEXT")
KUBECTL+=(-n "$NAMESPACE")

if [ -z "$POD" ]; then
    POD=$("${KUBECTL[@]}" get pods -o name \
        | grep -E 'pod/platforma-[0-9a-f]{6,}' | head -1 | sed 's|^pod/||')
    [ -n "$POD" ] || die "no platforma pod found in namespace $NAMESPACE"
fi

SAMPLES=$(( DURATION / INTERVAL + 1 ))
ADDR="http://127.0.0.1:${DEBUG_PORT}"

echo "pod=$POD namespace=$NAMESPACE samples=$SAMPLES interval=${INTERVAL}s"

# Sampler lives in the pod so a dropped exec stream cannot abort the run.
"${KUBECTL[@]}" exec -i "$POD" -- sh -c "cat > ${POD_DIR}.sh" <<'SAMPLER'
#!/bin/sh
set -eu
DIR=$1; INTERVAL=$2; COUNT=$3; ADDR=$4; TRACE_SECONDS=$5
rm -rf "$DIR"; mkdir -p "$DIR"
i=1
while [ "$i" -le "$COUNT" ]; do
    TS=$(date -u +%H%M%SZ)
    curl -s "$ADDR/debug/pprof/goroutine?debug=1" | gzip > "$DIR/goroutine-$i-$TS.txt.gz"
    curl -s -o "$DIR/heap-$i-$TS.pb.gz" "$ADDR/debug/pprof/heap"
    if [ "$i" -eq 1 ]; then
        curl -s -o "$DIR/trace.out" "$ADDR/debug/pprof/trace?seconds=$TRACE_SECONDS"
        curl -s -o "$DIR/allocs.pb.gz" "$ADDR/debug/pprof/allocs"
        curl -s "$ADDR/debug/pprof/goroutine?debug=2" | gzip > "$DIR/goroutine-stacks-full.txt.gz"
    fi
    i=$((i + 1))
    [ "$i" -le "$COUNT" ] && sleep "$INTERVAL"
done
# One line per sample: index, timestamp, live goroutine count.
for f in "$DIR"/goroutine-*-*.txt.gz; do
    case "$f" in *stacks-full*) continue ;; esac
    base=$(basename "$f" .txt.gz)
    total=$(gzip -dc "$f" | head -1 | awk '{print $NF}')
    echo "$base $total"
done > "$DIR/goroutine-totals.txt"
touch "$DIR/DONE"
SAMPLER

"${KUBECTL[@]}" exec "$POD" -- sh -c \
    "chmod +x ${POD_DIR}.sh && nohup ${POD_DIR}.sh ${POD_DIR} ${INTERVAL} ${SAMPLES} ${ADDR} ${TRACE_SECONDS} >${POD_DIR}.log 2>&1 &" \
    || die "failed to start in-pod sampler"

echo "sampler started; expected finish in ~$(( DURATION + TRACE_SECONDS ))s"
echo "poll with: $0 --context '$CONTEXT' -n '$NAMESPACE' --pod '$POD' --out '$OUT' --collect-only"

if [ -n "${COLLECT_ONLY:-}" ]; then exit 0; fi

deadline=$(( DURATION + TRACE_SECONDS + 120 ))
waited=0
until "${KUBECTL[@]}" exec "$POD" -- test -f "${POD_DIR}/DONE" 2>/dev/null; do
    [ "$waited" -ge "$deadline" ] && die "sampler did not finish within ${deadline}s"
    sleep 15
    waited=$(( waited + 15 ))
done

mkdir -p "$OUT"
"${KUBECTL[@]}" cp "${POD}:${POD_DIR}" "$OUT" --retries 3
"${KUBECTL[@]}" exec "$POD" -- sh -c "rm -rf ${POD_DIR} ${POD_DIR}.sh ${POD_DIR}.log" || true

echo "--- goroutine totals ---"
cat "$OUT/goroutine-totals.txt"
echo "collected into $OUT"
