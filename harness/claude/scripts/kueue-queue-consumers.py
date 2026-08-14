#!/usr/bin/env python3
"""Report who consumes a Kueue ClusterQueue.

Groups the namespace's Kueue workloads by the software image of their first
pod set, so a saturated queue names its occupant instead of a pod list. For
Platforma (`pl-k8s-*`) jobs it also reads the per-job env the backend sets --
BLOCK_VERSION, the workdir, the command -- and tails one pod log per group to
show progress.

Usage:
  kueue-queue-consumers.py [-n NAMESPACE] [-c CONTEXT] [--logs N] [--json]

Defaults: namespace platforma-app, current kubectl context, 2 sample logs.
"""

import argparse
import collections
import json
import re
import subprocess
import sys
from datetime import datetime, timezone

PROGRESS = re.compile(r"\[(\d+)\s*/\s*(\d+)\]")


def kubectl(args, ctx, want_json=True):
    cmd = ["kubectl"]
    if ctx:
        cmd += ["--context", ctx]
    cmd += args
    if want_json:
        cmd += ["-o", "json"]
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        print(out.stderr.strip(), file=sys.stderr)
        sys.exit(out.returncode)
    return json.loads(out.stdout) if want_json else out.stdout


def short_image(image):
    """pl-containers:<software>.<hash> -> <software>; else the bare repo tag."""
    tail = image.split("pl-containers:")[-1]
    if tail is image and "/" in image:
        return image.split("/")[-1]
    parts = tail.split(".")
    return ".".join(parts[:-1]) if len(parts) > 1 else tail


def age(stamp):
    then = datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - then).total_seconds() / 60.0


def env_of(container):
    return {e["name"]: e.get("value", "") for e in container.get("env", [])}


def cq_report(ctx):
    out = []
    for cq in kubectl(["get", "clusterqueues"], ctx)["items"]:
        quota, usage = {}, {}
        for rg in cq["spec"].get("resourceGroups", []):
            for fl in rg["flavors"]:
                quota[fl["name"]] = {r["name"]: r["nominalQuota"] for r in fl["resources"]}
        for fu in cq.get("status", {}).get("flavorsUsage", []):
            usage[fu["name"]] = {r["name"]: r["total"] for r in fu["resources"]}
        st = cq.get("status", {})
        out.append({
            "name": cq["metadata"]["name"],
            "pending": st.get("pendingWorkloads"),
            "admitted": st.get("admittedWorkloads"),
            "quota": quota,
            "usage": usage,
        })
    return out


def workload_groups(ctx, ns):
    groups = collections.defaultdict(lambda: {
        "admitted": 0, "pending": 0, "cpu": 0.0, "flavors": collections.Counter(),
        "gpu_requested": 0, "block_versions": set(), "cmds": set(),
        "oldest_min": 0.0, "newest_min": 1e9, "jobs": [],
    })
    for w in kubectl(["get", "workloads.kueue.x-k8s.io", "-n", ns], ctx)["items"]:
        ps = w["spec"]["podSets"][0]
        c = ps["template"]["spec"]["containers"][0]
        key = short_image(c["image"])
        g = groups[key]
        admitted = w["status"].get("admission")
        req = c.get("resources", {}).get("requests", {})
        cpu = float(str(req.get("cpu", "0")).rstrip("m")) / (
            1000.0 if str(req.get("cpu", "")).endswith("m") else 1.0)
        if admitted:
            g["admitted"] += 1
            g["cpu"] += cpu * ps.get("count", 1)
            for a in admitted.get("podSetAssignments", []):
                g["flavors"][a.get("flavors", {}).get("cpu", "?")] += 1
                if float(a.get("resourceUsage", {}).get("nvidia.com/gpu", 0) or 0) > 0:
                    g["gpu_requested"] += 1
        else:
            g["pending"] += 1
        env = env_of(c)
        if env.get("BLOCK_VERSION"):
            g["block_versions"].add(env["BLOCK_VERSION"])
        if env.get("PL_JOB_CMD_AND_ARGS"):
            g["cmds"].add(env["PL_JOB_CMD_AND_ARGS"][:220])
        a = age(w["metadata"]["creationTimestamp"])
        g["oldest_min"] = max(g["oldest_min"], a)
        g["newest_min"] = min(g["newest_min"], a)
        g["jobs"].append(w["metadata"].get("ownerReferences", [{}])[0].get("name", ""))
    return groups


def sample_progress(ctx, ns, image_key, limit):
    """Tail pods of one software group, return the newest [n/total] marker each."""
    pods = kubectl(["get", "pods", "-n", ns], ctx)["items"]
    hits = []
    for p in pods:
        cs = p["spec"]["containers"][0]
        if short_image(cs["image"]) != image_key:
            continue
        hits.append((age(p["metadata"]["creationTimestamp"]), p["metadata"]["name"]))
    hits.sort(reverse=True)
    out = []
    for mins, name in hits[:limit]:
        log = kubectl(["logs", "-n", ns, name, "--tail=400"], ctx, want_json=False)
        marks = PROGRESS.findall(log)
        first = log.strip().split("\n")[0][:160] if log.strip() else ""
        done, total = (marks[-1] if marks else ("?", "?"))
        out.append({"pod": name, "age_min": round(mins, 1), "done": done,
                    "total": total, "first_line": first})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", "--namespace", default="platforma-app")
    ap.add_argument("-c", "--context", default=None)
    ap.add_argument("--logs", type=int, default=2, help="pods to tail per group")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    report = {"clusterQueues": cq_report(a.context), "groups": []}
    for key, g in sorted(workload_groups(a.context, a.namespace).items(),
                         key=lambda kv: -(kv[1]["admitted"] + kv[1]["pending"])):
        report["groups"].append({
            "software": key,
            "admitted": g["admitted"], "pending": g["pending"],
            "cpu_held": g["cpu"],
            "flavors": dict(g["flavors"]),
            "workloads_requesting_gpu": g["gpu_requested"],
            "block_versions": sorted(g["block_versions"]),
            "oldest_min": round(g["oldest_min"], 1),
            "newest_min": round(g["newest_min"], 1),
            "sample_cmd": sorted(g["cmds"])[:1],
            "progress": sample_progress(a.context, a.namespace, key, a.logs) if a.logs else [],
        })

    if a.json:
        print(json.dumps(report, indent=2))
        return

    for cq in report["clusterQueues"]:
        print(f"ClusterQueue {cq['name']}: admitted={cq['admitted']} pending={cq['pending']}")
        for fl, q in cq["quota"].items():
            u = cq["usage"].get(fl, {})
            pairs = ", ".join(f"{r}={u.get(r,'?')}/{v}" for r, v in q.items())
            print(f"  {fl}: {pairs}")
    print()
    for g in report["groups"]:
        print(f"=== {g['software']}")
        print(f"  workloads: {g['admitted']} admitted, {g['pending']} pending"
              f" | cpu held: {g['cpu_held']:g} | flavors: {g['flavors']}"
              f" | requesting GPU: {g['workloads_requesting_gpu']}")
        print(f"  age: oldest {g['oldest_min']} min, newest {g['newest_min']} min"
              f" | block versions: {g['block_versions']}")
        for c in g["sample_cmd"]:
            print(f"  cmd: {c}")
        for p in g["progress"]:
            print(f"  {p['pod']} ({p['age_min']} min): {p['done']}/{p['total']}"
                  f" | {p['first_line']}")
        print()


if __name__ == "__main__":
    main()
