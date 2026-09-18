#!/usr/bin/env python3
"""Merge a checker-suggested whitelist block into a runenv-python-3 whitelist file.

Usage: merge-runenv-whitelist.py <suggested.json> <whitelists/<platform>.json>

The native import checker prints a ready JSON block after "To whitelist these
errors". Extract that block to a file and merge it here: existing entries keep
their module maps, new modules are added, and key order is preserved.
"""
import collections
import json
import sys


def main(suggested_path: str, whitelist_path: str) -> int:
    suggested = json.load(open(suggested_path))
    whitelist = json.load(open(whitelist_path), object_pairs_hook=collections.OrderedDict)
    added = 0
    for wheel, modules in suggested.items():
        entry = whitelist.setdefault(wheel, collections.OrderedDict())
        for module, message in modules.items():
            if module not in entry:
                entry[module] = message
                added += 1
    with open(whitelist_path, "w") as fh:
        json.dump(whitelist, fh, indent=2)
        fh.write("\n")
    print(f"{whitelist_path}: +{added} module(s)")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
