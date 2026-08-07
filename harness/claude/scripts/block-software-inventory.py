#!/usr/bin/env python3
"""Inventory Platforma block software packages and cross-block reuse.

Usage: block-software-inventory.py <blocks-root> [--json]

Scans every package.json under <blocks-root> (skipping node_modules/.git) and reports:
  * packages that declare `block-software` entrypoints (the producers)
  * entrypoint -> artifact type / runenv environment / requirements file
  * which blocks depend on software packages owned by ANOTHER block (the consumers)
"""
import json
import os
import sys
from collections import defaultdict

SKIP = {"node_modules", ".git", "dist", ".turbo", ".pnpm-store"}


def iter_pkg_json(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP]
        if "package.json" in filenames:
            yield os.path.join(dirpath, "package.json")


def block_of(root, path):
    rel = os.path.relpath(path, root)
    return rel.split(os.sep)[0]


def main():
    root = os.path.abspath(sys.argv[1])
    as_json = "--json" in sys.argv

    producers = {}          # pkg name -> {block, entrypoints: {name: info}}
    deps = defaultdict(set)  # block -> set(dep pkg name)

    for pj in iter_pkg_json(root):
        try:
            with open(pj) as fh:
                data = json.load(fh)
        except Exception:
            continue
        name = data.get("name")
        block = block_of(root, pj)
        if not name:
            continue

        sw = data.get("block-software")
        if isinstance(sw, dict) and sw.get("entrypoints"):
            eps = {}
            for ep, body in sw["entrypoints"].items():
                if not isinstance(body, dict):
                    eps[ep] = {"type": "ref", "environment": str(body), "requirements": None}
                    continue
                if "reference" in body:
                    eps[ep] = {"type": "ref", "environment": str(body["reference"]), "requirements": None}
                    continue
                kind = body.get("binary") or body.get("runEnv") or body.get("asset") or {}
                art = kind.get("artifact", {}) if isinstance(kind, dict) else {}
                if isinstance(art, str):
                    eps[ep] = {"type": "artifact-ref", "environment": art, "requirements": None}
                    continue
                deps_ = art.get("dependencies") or {}
                eps[ep] = {
                    "type": art.get("type"),
                    "environment": art.get("environment"),
                    "requirements": deps_.get("requirements") if isinstance(deps_, dict) else None,
                }
            producers[name] = {"block": block, "path": os.path.relpath(pj, root), "entrypoints": eps}

        for field in ("dependencies", "devDependencies", "peerDependencies"):
            for dep in (data.get(field) or {}):
                if dep.startswith("@platforma-open/"):
                    deps[block].add(dep)

    if as_json:
        json.dump({"producers": producers, "deps": {k: sorted(v) for k, v in deps.items()}},
                  sys.stdout, indent=2)
        return

    owner = {name: info["block"] for name, info in producers.items()}

    print(f"# producers: {len(producers)} software packages")
    for name in sorted(producers):
        info = producers[name]
        print(f"\n{name}  [{info['block']}]")
        for ep, i in sorted(info["entrypoints"].items()):
            print(f"    {ep:<28} {i['type'] or '-':<8} env={i['environment'] or '-'}  req={i['requirements'] or '-'}")

    print("\n# cross-block software dependencies (consumer -> package [owner])")
    for block in sorted(deps):
        for dep in sorted(deps[block]):
            o = owner.get(dep)
            if o and o != block:
                print(f"{block:<40} -> {dep}  [{o}]")

    print("\n# environments used, by frequency")
    envs = defaultdict(set)
    for name, info in producers.items():
        for ep, i in info["entrypoints"].items():
            if i["environment"]:
                envs[i["environment"]].add(f"{info['block']}:{ep}")
    for env, users in sorted(envs.items(), key=lambda kv: -len(kv[1])):
        print(f"{len(users):>4}  {env}")


if __name__ == "__main__":
    main()
