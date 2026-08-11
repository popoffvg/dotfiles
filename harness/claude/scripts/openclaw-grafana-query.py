#!/usr/bin/env python3
"""Run a dashboard panel's query through Grafana on the openclaw box and report
what the panel would render: an error, no series, or the series names.

Grafana is bound to localhost on the server, so every request goes through
`ssh openclaw docker exec otel-lgtm curl`. Payloads travel as a base64 blob to
keep the shell out of the query text — TraceQL is full of quotes and `&&`.

Usage:
  openclaw-grafana-query.py --panel <id> --range 24h [--dashboard <path>]
  openclaw-grafana-query.py --query '<traceql or promql>' --ds tempo --range 6h

Exit 1 when any query errors.
"""

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import time

UNITS = {"s": 1, "m": 60, "h": 3600, "d": 86400}

# otel-lgtm ships Grafana with its unchanged default login. Override with
# GRAFANA_AUTH=user:password when the box gets real credentials.
GRAFANA_AUTH = os.environ.get("GRAFANA_AUTH", "admin:admin")  # gitleaks:allow


def parse_range(text):
    match = re.fullmatch(r"(\d+)([smhd])", text)
    if not match:
        sys.exit(f"bad --range {text!r}: use forms like 90m, 6h, 24h, 2d")
    return int(match.group(1)) * UNITS[match.group(2)]


def run_on_server(command):
    result = subprocess.run(
        ["ssh", "openclaw", command], capture_output=True, text=True
    )
    if result.returncode != 0:
        sys.exit(f"ssh failed: {result.stderr.strip()}")
    return result.stdout


def grafana_query(queries, start_ms, end_ms):
    payload = json.dumps(
        {"queries": queries, "from": str(start_ms), "to": str(end_ms)}
    )
    blob = base64.b64encode(payload.encode()).decode()
    command = (
        f"echo {blob} | docker exec -i otel-lgtm sh -c "
        f"'base64 -d > /tmp/q.json && curl -s -u {GRAFANA_AUTH} "
        "-H \"Content-Type: application/json\" -X POST "
        "http://localhost:3000/api/ds/query -d @/tmp/q.json'"
    )
    raw = run_on_server(command)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        sys.exit(f"grafana returned non-JSON: {raw[:400]}")


def panel_queries(dashboard_path, panel_id):
    dashboard = json.load(open(dashboard_path))
    for panel in dashboard["panels"]:
        if panel.get("id") != panel_id:
            continue
        queries = []
        for target in panel.get("targets", []):
            query = dict(target)
            # /api/ds/query needs a uid; the dashboard omits it on panels that
            # ride Grafana's default datasource (Prometheus here) or that name
            # only the type. Resolve both the way Grafana's frontend does.
            datasource = dict(target.get("datasource") or panel.get("datasource") or {})
            datasource.setdefault("type", "prometheus")
            datasource.setdefault("uid", datasource["type"])
            query["datasource"] = datasource
            queries.append(query)
        if not queries:
            sys.exit(f"panel {panel_id} has no targets")
        return panel, queries
    sys.exit(f"no panel with id {panel_id} in {dashboard_path}")


def frame_label(frame):
    """Series identity: the frame name, else the labels of its value field."""
    schema = frame.get("schema", {})
    name = schema.get("name")
    fields = schema.get("fields", [])
    labels = {}
    for field in fields:
        if field.get("labels"):
            labels = field["labels"]
    if name and name not in ("", "A"):
        return name
    if labels:
        return ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
    return name or "?"


def describe(result, show_values):
    if "error" in result:
        return f"ERROR: {result['error']}"
    frames = result.get("frames", [])
    named = []
    for frame in frames:
        values = frame.get("data", {}).get("values") or []
        # A frame with a value column of only nulls renders as blank / "—".
        column = values[-1] if len(values) > 1 else (values[0] if values else [])
        present = [v for v in column if v is not None]
        text = f"{frame_label(frame)}({len(present)}/{len(column)} pts)"
        if show_values and present:
            tail = present[-3:]
            text += " last=" + ",".join(
                f"{v:.4g}" if isinstance(v, (int, float)) else str(v) for v in tail
            )
        named.append(text)
    if not named:
        return "NO DATA (0 frames)"
    return f"{len(frames)} frames: " + ", ".join(named)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--panel", type=int)
    parser.add_argument("--dashboard", default="ansible/roles/otel-lgtm/files/dashboard.json")
    parser.add_argument("--query")
    parser.add_argument("--ds", default="tempo", choices=["tempo", "prometheus", "loki"])
    parser.add_argument("--range", default="6h")
    parser.add_argument("--end", type=int, help="end as unix seconds (default now)")
    parser.add_argument(
        "--panel-time",
        action="store_true",
        help="use the panel's own timeFrom window instead of --range, the way "
        "Grafana does for a panel with a relative-time override",
    )
    parser.add_argument("--values", action="store_true", help="print the last points")
    args = parser.parse_args()

    end = args.end or int(time.time())
    window = args.range
    start = end - parse_range(window)

    if args.panel is not None:
        panel, queries = panel_queries(args.dashboard, args.panel)
        label = f"panel {args.panel} {panel['title']!r}"
        if args.panel_time and panel.get("timeFrom"):
            window = panel["timeFrom"]
            start = end - parse_range(window)
            label += " [timeFrom]"
    elif args.query:
        query_type = "traceql" if args.ds == "tempo" else None
        query = {
            "refId": "A",
            "datasource": {"type": args.ds, "uid": args.ds},
        }
        if query_type:
            query["queryType"] = query_type
            query["query"] = args.query
        else:
            query["expr"] = args.query
            query["instant"] = True
        queries = [query]
        label = f"ad-hoc {args.ds} query"
    else:
        sys.exit("give --panel or --query")

    response = grafana_query(queries, start * 1000, end * 1000)
    print(f"{label} over {window} (ending {time.strftime('%F %T', time.localtime(end))})")
    failed = False
    for ref_id, result in sorted(response.get("results", {}).items()):
        text = describe(result, args.values)
        if text.startswith("ERROR"):
            failed = True
        print(f"  [{ref_id}] {text}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
