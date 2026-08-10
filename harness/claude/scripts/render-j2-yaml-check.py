#!/usr/bin/env python3
"""render-j2-yaml-check.py — parse a Jinja2-templated YAML file as YAML.

Substitutes every {{ var }} with a placeholder string, then runs the result through
yaml.safe_load. Catches the indentation and key-shape errors that make an ansible
template deploy broken YAML, without needing a venv or the real inventory.

Optionally asserts that a dotted key path exists in the parsed document:

    render-j2-yaml-check.py <file.j2> [--has collections.z-core.ignore]

Exit 0 on valid YAML (and all --has paths present), 1 otherwise.
"""
import re
import sys

import yaml


def render(text):
    """Replace {{ anything }} with a quoted placeholder so YAML can parse it."""
    return re.sub(r"\{\{[^}]*\}\}", "'__rendered__'", text)


def get_path(doc, dotted):
    node = doc
    for part in dotted.split("."):
        if not isinstance(node, dict) or part not in node:
            return None, part
        node = node[part]
    return node, None


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path = sys.argv[1]
    wanted = [a for i, a in enumerate(sys.argv) if sys.argv[i - 1] == "--has"]

    with open(path, encoding="utf8") as fh:
        raw = fh.read()

    try:
        doc = yaml.safe_load(render(raw))
    except yaml.YAMLError as err:
        print(f"INVALID YAML: {path}\n{err}")
        return 1

    print(f"valid YAML: {path}")
    failed = False
    for dotted in wanted:
        value, missing = get_path(doc, dotted)
        if missing is not None:
            print(f"MISSING KEY: {dotted} (stopped at '{missing}')")
            failed = True
        else:
            print(f"  {dotted} = {value!r}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
