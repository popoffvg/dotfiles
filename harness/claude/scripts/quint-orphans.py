#!/usr/bin/env python3
"""Show which actions and collections of a Quint model no invariant needs.

The model must use the State/commit shape: a `type State = {...}` record with one
field per collection, actions that write through `commit({ ...now, field: ... })`,
and a `val allInvariants: bool = and { ... }` list.

Usage: quint-orphans.py [--check] [--matrix] model.qnt...
  --matrix  print the action x invariant matrix
  --check   exit 1 when a model has an orphan action or a dead collection
"""
import re
import sys

DEF_RE = re.compile(r"^  (?:pure def|def|val|action|temporal)\s+([A-Za-z_][A-Za-z0-9_]*)")
STOP_RE = re.compile(r"^  (?://|pure def|def |val |action |temporal |const |type |import |var )")
SKIP_ACTIONS = {"commit", "init", "step"}


def main_module(text):
    lines = text.splitlines()
    start = next(i for i, l in enumerate(lines) if re.match(r"^module \w+ \{", l))
    end = next(i for i in range(start + 1, len(lines)) if lines[i].startswith("}"))
    return lines[start + 1:end]


def state_fields(lines):
    i = next(i for i, l in enumerate(lines) if re.match(r"^  type State = \{", l))
    fields = []
    for l in lines[i + 1:]:
        if l.strip().startswith("}"):
            break
        m = re.match(r"^\s+([A-Za-z_]\w*)\s*:", l)
        if m:
            fields.append(m.group(1))
    return fields


def definitions(lines):
    defs, kinds, cur = {}, {}, None
    for l in lines:
        m = DEF_RE.match(l)
        if m:
            cur = m.group(1)
            kinds[cur] = l.split()[0] if not l.strip().startswith("pure") else "pure"
            defs[cur] = [l]
        elif cur and STOP_RE.match(l):
            cur = None
        elif cur:
            defs[cur].append(l)
    return {k: "\n".join(v) for k, v in defs.items()}, kinds


def code_only(body):
    return "\n".join(l.split("//")[0] for l in body.splitlines())


def invariant_names(defs):
    body = defs.get("allInvariants", "")
    inner = body[body.find("{") + 1:body.rfind("}")]
    return [n for n in re.findall(r"[A-Za-z_]\w*", inner)]


def analyze(path):
    lines = main_module(open(path).read())
    fields = state_fields(lines)
    defs, kinds = definitions(lines)
    bodies = {k: code_only(v) for k, v in defs.items()}
    names = set(bodies)

    def direct_reads(name):
        return {f for f in fields if re.search(r"\." + f + r"\b", bodies[name])}

    def calls(name):
        head, _, rest = bodies[name].partition("=")
        return {n for n in names if n != name and re.search(r"\b" + n + r"\b", rest)}

    memo = {}

    def reads(name, seen=()):
        if name in memo:
            return memo[name]
        r = set(direct_reads(name))
        for c in calls(name):
            if c not in seen and kinds.get(c) in ("pure", "def", "val") and c not in ("now",):
                r |= reads(c, seen + (name,))
        memo[name] = r
        return r

    def writes(name):
        return {f for f in fields if re.search(r"\b" + f + r"\s*:(?!:)", bodies[name])}

    invariants = invariant_names(defs)
    actions = [n for n, k in kinds.items() if k == "action" and n not in SKIP_ACTIONS]
    inv_reads = {i: reads(i) for i in invariants if i in bodies}
    checked = set().union(*inv_reads.values()) if inv_reads else set()
    act_writes = {a: writes(a) for a in actions}
    act_reads = {a: reads(a) for a in actions}

    steers = set()
    changed = True
    while changed:
        changed = False
        for a in actions:
            if act_writes[a] & (checked | steers):
                for f in act_reads[a] - checked - steers:
                    steers.add(f)
                    changed = True
    dead = [f for f in fields if f not in checked and f not in steers]

    rows = []
    for a in actions:
        hit = [i for i in inv_reads if act_writes[a] & inv_reads[i]]
        if hit:
            status = "breaks-invariant"
        elif act_writes[a] & steers:
            status = "steers-only"
        else:
            status = "orphan"
        rows.append((a, "env" if a.startswith("env") else "own", status, hit, act_writes[a]))

    return {
        "path": path,
        "lines": len(open(path).read().splitlines()),
        "fields": fields,
        "invariants": invariants,
        "inv_reads": inv_reads,
        "checked": checked,
        "steers": steers,
        "dead": dead,
        "rows": rows,
    }


def report(r, matrix):
    rows = r["rows"]
    n_inv = len(r["invariants"]) or 1
    orphans = [x for x in rows if x[2] == "orphan"]
    steer = [x for x in rows if x[2] == "steers-only"]
    print(f"## {r['path']}")
    print(f"lines={r['lines']} actions={len(rows)} invariants={len(r['invariants'])} "
          f"collections={len(r['fields'])} lines-per-invariant={r['lines'] // n_inv} "
          f"actions-per-invariant={len(rows) / n_inv:.1f}")
    print(f"collections read by an invariant: {len(r['checked'])}/{len(r['fields'])}")
    print(f"  not read by an invariant, steer a checked write: {', '.join(sorted(r['steers'])) or '-'}")
    print(f"  dead (no invariant and no steering read): {', '.join(r['dead']) or '-'}")
    print(f"orphan actions (write nothing an invariant or a guard reads): "
          f"{', '.join(x[0] for x in orphans) or '-'}")
    print(f"steers-only actions (write only guard inputs): {', '.join(x[0] for x in steer) or '-'}")
    per_inv = {i: [x[0] for x in rows if i in x[3]] for i in r["invariants"]}
    print("actions that can break each invariant:")
    for i, acts in per_inv.items():
        print(f"  {i} ({len(acts)}): reads {', '.join(sorted(r['inv_reads'].get(i, []))) or '-'}")
    if matrix:
        inv = r["invariants"]
        print()
        print("| action | kind | " + " | ".join(inv) + " |")
        print("|---|---|" + "---|" * len(inv))
        for a, kind, status, hit, _ in rows:
            print(f"| {a} | {kind} | " + " | ".join("x" if i in hit else "" for i in inv) + " |")
    print()
    return bool(orphans or r["dead"])


def run():
    args = sys.argv[1:]
    check = "--check" in args
    matrix = "--matrix" in args
    paths = [a for a in args if not a.startswith("--")]
    if not paths:
        print(__doc__)
        sys.exit(2)
    bad = False
    for p in paths:
        bad |= report(analyze(p), matrix)
    if check and bad:
        sys.exit(1)


if __name__ == "__main__":
    run()
