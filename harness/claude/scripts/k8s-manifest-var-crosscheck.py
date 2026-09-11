#!/usr/bin/env python3
"""Cross-check every $(VAR) placeholder in a rendered Kubernetes manifest
against the env var names declared on the same container.

The kubelet expands $(VAR) in command, args and env values only against names
the same container declares; an unmatched name is left in the string verbatim
and the process receives the literal text. Reports one line per container.

Args: <rendered.yaml>... [--expect-env NAME=secret/key]... [--absent STRING]...
Exit 1 on an unmatched placeholder, a failed expectation, or a present string.
"""

import re
import sys

import yaml

PLACEHOLDER = re.compile(r"\$\(([A-Za-z_][A-Za-z0-9_]*)\)")


def containers(doc):
    spec = (doc.get("spec") or {}).get("template", {}).get("spec") or doc.get("spec") or {}
    for key in ("initContainers", "containers"):
        for c in spec.get(key) or []:
            yield c


def env_map(container):
    out = {}
    for e in container.get("env") or []:
        ref = (e.get("valueFrom") or {}).get("secretKeyRef")
        out[e["name"]] = f"secret/{ref['name']}/{ref['key']}" if ref else ("value/" + str(e.get("value")))
    return out


def main():
    paths, expects, absents = [], [], []
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--expect-env":
            expects.append(args[i + 1])
            i += 2
        elif args[i] == "--absent":
            absents.append(args[i + 1])
            i += 2
        else:
            paths.append(args[i])
            i += 1

    failed = False
    for path in paths:
        text = open(path).read()
        docs = [d for d in yaml.safe_load_all(text) if isinstance(d, dict)]
        print(f"== {path}: {len(docs)} documents parsed")

        seen_env = {}
        for doc in docs:
            for c in containers(doc):
                names = env_map(c)
                seen_env.update(names)
                cited = set()
                for field in ("command", "args"):
                    for s in c.get(field) or []:
                        cited |= set(PLACEHOLDER.findall(str(s)))
                for e in c.get("env") or []:
                    if e.get("value") is not None:
                        cited |= set(PLACEHOLDER.findall(str(e["value"])))
                missing = sorted(cited - set(names))
                label = f"{doc.get('kind')}/{doc.get('metadata', {}).get('name')}:{c.get('name')}"
                if missing:
                    failed = True
                    print(f"   FAIL {label}: placeholders with no env var: {missing}")
                else:
                    print(f"   ok   {label}: {len(cited)} placeholders all declared ({len(names)} env vars)")

        for spec in expects:
            name, _, want = spec.partition("=")
            got = seen_env.get(name)
            if got == want:
                print(f"   ok   env {name} -> {got}")
            else:
                failed = True
                print(f"   FAIL env {name}: want {want!r}, got {got!r}")

        for needle in absents:
            if needle in text:
                failed = True
                hits = [n for n, l in enumerate(text.splitlines(), 1) if needle in l]
                print(f"   FAIL string {needle!r} PRESENT at lines {hits}")
            else:
                print(f"   ok   string {needle!r} absent")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
