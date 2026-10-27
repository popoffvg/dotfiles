"""Check one written `## Properties` section; print one line per defect, nothing when clean.

Usage: check-adr-properties.py <section.md> '<json list of required regexes>'
"""
import json
import re
import sys

LINE = re.compile(r"^- P(\d+)\. \[(keep|new)\] (\S.*)$")
BANNED = [
    ("link", re.compile(r"\]\(")),
    ("file:line", re.compile(r"\b[\w./-]+\.\w+:\d+")),
    ("evidence word", re.compile(r"\b(today on|closes|today:|new:)", re.I)),
]


def main() -> int:
    text = open(sys.argv[1], encoding="utf-8").read()
    must = json.loads(sys.argv[2])
    props = [l for l in text.splitlines() if l.startswith("- P")]
    if not props:
        print("no Property line")
        return 0
    marks = []
    for raw in props:
        m = LINE.match(raw)
        if not m:
            print(f"format: {raw[:80]}")
            continue
        marks.append(m.group(2))
        for name, rx in BANNED:
            hit = rx.search(m.group(3))
            if hit:
                print(f"{name} '{hit.group(0)}': {raw[:80]}")
    if "keep" in marks and "new" in marks and marks.index("new") < len(marks) - marks[::-1].index("keep") - 1:
        print("order: a [new] Property comes before a [keep] one")
    body = "\n".join(props)
    for rx in must:
        if not re.search(rx, body, re.I):
            print(f"coverage: no Property matches /{rx}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
