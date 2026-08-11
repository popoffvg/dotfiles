#!/usr/bin/env bash
# Compare what a dashboard panel reads against a reset-aware true count for one span metric.
# Usage: openclaw-spanmetric-truth.sh <span_name> [hours]
set -euo pipefail

span=${1:?span_name required}
hours=${2:-24}
S="$(dirname "$0")/openclaw-promql.sh"
end=$(date +%s)
start=$((end - hours * 3600))
metric="traces_spanmetrics_calls_total{service=\"pi\",span_name=\"$span\"}"
delta="(max_over_time($metric[1h]) - min_over_time($metric[1h])) + ((min_over_time($metric[1h]) unless min_over_time($metric[1h] offset 1h)) or (min_over_time($metric[1h]) * 0))"

"$S" "sum(max_over_time($metric[${hours}h]))" > /tmp/panel_range.json
"$S" "$metric" range "$start" "$end" 60 > /tmp/raw.json
"$S" "sum by (status_code) ($delta)" range "$start" "$end" 3600 > /tmp/panel_hourly.json

python3 - "$span" "$hours" <<'PY'
import json, sys
span, hours = sys.argv[1], sys.argv[2]
panel = json.load(open('/tmp/panel_range.json'))['data']['result']
print(f"span={span} window={hours}h")
print("  panel 'in range' tile  :", panel[0]['value'][1] if panel else 'NO DATA')

raw = json.load(open('/tmp/raw.json'))['data']['result']
total = 0
for s in raw:
    vals = [float(v) for _, v in s['values']]
    run = vals[0]
    for prev, cur in zip(vals, vals[1:]):
        run += cur - prev if cur >= prev else cur   # counter reset -> take the new value whole
    total += run
    print(f"  series {s['metric']['__metrics_gen_instance']} {s['metric']['status_code']}: "
          f"reset-aware={run:g} max={max(vals):g} points={len(vals)}")
print(f"  reset-aware true count : {total:g}")

hourly = json.load(open('/tmp/panel_hourly.json'))['data']['result']
for s in hourly:
    ssum = sum(float(v) for _, v in s['values'])
    print(f"  panel hourly sum ({s['metric'].get('status_code')}) : {ssum:g}")
PY
