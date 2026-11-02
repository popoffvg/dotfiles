"""Check one written ADR file against ADR-FORMAT.md; print one line per defect, nothing when clean.

Usage: check-adr-file.py <adr.md> '<json list of regexes the Property cells must cover>'
"""
import json
import re
import sys

HEADER = "| Id | Property | If broken | Recovers by |"
ROW = re.compile(r"^\| P(\d+) \| \[(keep|new)\] ((?:[^|\\]|\\.)+?) \| ((?:[^|\\]|\\.)+?) \| (retry|restart|a human|itself) \|$")
Y = re.compile(r"In the context of .+?, facing .+?, we decided for .+? and against .+?, to .+?, accepting .+?\.", re.S)
CHOICE_VERB = re.compile(r"^# (use|add|move|store|switch to|adopt|introduce)\b", re.I)
MECHANISM = re.compile(r"`[A-Za-z_][\w.]*\(\)`|\b[a-z]+[A-Z]\w*\b|\berr[A-Z]\w*")
BANNED = [
    ("link", re.compile(r"\]\(")),
    ("file:line", re.compile(r"\b[\w./-]+\.\w+:\d+")),
    ("evidence word", re.compile(r"\b(today on|closes|today:|new:)", re.I)),
]


def sections(text):
    out, name = {}, None
    for line in text.splitlines():
        if line.startswith("## "):
            name = line[3:].strip()
            out[name] = []
        elif name:
            out[name].append(line)
    return out


def main() -> int:
    text = open(sys.argv[1], encoding="utf-8").read().strip()
    text = re.sub(r"\A```\w*\n|\n```\Z", "", text)
    must = json.loads(sys.argv[2])
    defects = []

    fm = re.match(r"\A---\n(.*?)\n---\n", text, re.S)
    if not fm:
        defects.append("frontmatter: missing")
    else:
        keys = dict(re.findall(r"^(\w+):\s*(\S+)", fm.group(1), re.M))
        if keys.get("status") != "proposed":
            defects.append(f"frontmatter: status is {keys.get('status')!r}, want 'proposed'")
        if keys.get("kind") not in ("architecture", "feature", "implementation"):
            defects.append(f"frontmatter: kind is {keys.get('kind')!r}")

    title = next((l for l in text.splitlines() if l.startswith("# ")), "")
    if not title:
        defects.append("title: missing")
    elif CHOICE_VERB.match(title):
        defects.append(f"title: names the option: {title[:70]}")

    secs = sections(text)
    order = list(secs)
    for name in ("Reason", "Properties", "Changelog"):
        if name not in secs:
            defects.append(f"section: no ## {name}")
    if order and order[-1] != "Changelog":
        defects.append("section: ## Changelog is not last")

    head = text.split("\n## ", 1)[0]
    paras = [p for p in head.split("\n\n")[1:] if p.strip() and not p.startswith("# ") and not p.startswith("---")]
    if any(p.lstrip().startswith("**") for p in paras):
        defects.append("paragraph: a bold sub-decision paragraph")
    if len(paras) > 1:
        defects.append(f"paragraph: {len(paras)} paragraphs before ## Reason, want 1")

    reason = "\n".join(secs.get("Reason", []))
    ys = Y.findall(reason)
    if not ys:
        defects.append("reason: no Y-statement")
    elif len(ys) > 3:
        defects.append(f"reason: {len(ys)} Y-statements, want at most 3")
    if not re.search(r"^Decided by ", reason, re.M):
        defects.append("reason: no 'Decided by' provenance line")
    if re.search(r"^>", reason, re.M):
        defects.append("reason: a quote block")

    props = secs.get("Properties", [])
    if HEADER not in [l.strip() for l in props]:
        defects.append("properties: no table header " + HEADER)
    rows = [l.strip() for l in props if l.strip().startswith("| P")]
    if not rows:
        defects.append("properties: no Property row")
    cells, marks = [], []
    for raw in rows:
        m = ROW.match(raw)
        if not m:
            defects.append(f"properties: row format: {raw[:80]}")
            continue
        if "dropped" in m.group(3).lower():
            defects.append(f"properties: a dropped row: P{m.group(1)}")
        marks.append(m.group(2))
        cell = m.group(3)
        cells.append(cell)
        if len(cell.split()) > 20:
            defects.append(f"properties: P{m.group(1)} has {len(cell.split())} words, want about 15")
        for name, rx in BANNED + [("mechanism", MECHANISM)]:
            hit = rx.search(cell)
            if hit:
                defects.append(f"properties: {name} '{hit.group(0)}' in P{m.group(1)}")
    if "keep" in marks and "new" in marks and marks.index("new") < len(marks) - marks[::-1].index("keep") - 1:
        defects.append("properties: a [new] row comes before a [keep] row")
    body = "\n".join(cells)
    for rx in must:
        if not re.search(rx, body, re.I):
            defects.append(f"coverage: no Property matches /{rx}/")

    print("\n".join(defects))
    return 0


if __name__ == "__main__":
    sys.exit(main())
