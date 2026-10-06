#!/usr/bin/env python3
"""Check a wm `<notes-dir>/GLOSSARY.md` against itself and against the corpus that uses it.

An entry is any heading whose block carries a `- **Status:**` bullet; a heading without one is
a context section. Entry shape: `arch:examples/glossary.md`.

The live corpus is `spec.md`, `todos/*.md`, `thoughts/*.md` (archived notes excluded), the
glossary's own definitions, and every `--code` root. A name matches across case and across the
separators `_`, `-`, and space, so `run id` finds `RunID`, `run_id`, and `runId`.

usage: glossary-lint.py <notes-dir> [--code <dir>]... [--undefined] [--json] [--quiet]
exit 0 every check passed - 1 at least one finding - 2 unusable notes dir
Tool index — every .notes tool and its flags: wm:TOOLS.md
"""
import collections
import glob
import json
import os
import re
import sys

STATUSES = {"new", "existing", "retired"}
KINDS = {
    "aggregate", "entity", "value-object", "event", "state",
    "command", "service", "flow", "gateway", "server", "consumer", "policy", "scheduler", "wiring",
}
CODE_EXTS = {".go", ".ts", ".tsx", ".js", ".jsx", ".rs", ".py", ".tf", ".java", ".kt", ".sh", ".yaml", ".yml"}
SKIP_DIRS = {".git", ".jj", "node_modules", "vendor", "dist", "build", "target", ".notes", "__pycache__"}
META_KEYS = {"forbidden", "code", "source", "replaced by", "status", "kind"}
UNDEFINED_MIN_USES = 5
UNDEFINED_TOP = 30
SHOWN_HITS = 3

HEADING = re.compile(r"^(#{1,4}) +(.+?)\s*$")
BULLET_KEY = re.compile(r"^\s*[-*]\s*\*\*([^:*]+):?\*\*:?\s*(.*)$")
FENCE = re.compile(r"^\s*(```|~~~)")
TABLE_ROW = re.compile(r"^\s*\|(.+)\|\s*$")
TABLE_RULE = re.compile(r"^\s*\|[\s:|-]+\|?\s*$")
BACKTICKED = re.compile(r"`([A-Za-z][A-Za-z0-9_.]{2,60})`")
WORD = re.compile(r"[A-Za-z0-9]+")
NEEDLES = {}
COMPOUND_TYPE = re.compile(r"^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+$")


class Findings:
    """Every check registers here — a pass leaves a row too."""

    def __init__(self):
        self.checks = []

    def check(self, cid, title):
        row = {"id": cid, "title": title, "findings": []}
        self.checks.append(row)
        return row

    def fail(self, row, where, message, remedy=""):
        row["findings"].append({"where": where, "message": message, "remedy": remedy})

    @property
    def failed(self):
        return [c for c in self.checks if c["findings"]]


def read(path):
    try:
        return open(path, encoding="utf-8", errors="replace").read().splitlines()
    except OSError:
        return None


def split_names(value):
    value = value.strip()
    if not value or value.lower().rstrip(".") == "none":
        return []
    return [n.strip(" `*.") for n in value.split(",") if n.strip(" `*.")]


def parse_glossary(lines):
    """Return the entries in file order: term, line, status, kind, forbidden, code, source, replaced_by, body."""
    blocks, current, in_fence = [], None, False
    for i, line in enumerate(lines, 1):
        if FENCE.match(line):
            in_fence = not in_fence
        m = None if in_fence else HEADING.match(line)
        if m:
            current = {"term": m.group(2).strip(" `*"), "line": i, "lines": []}
            blocks.append(current)
        elif current is not None:
            current["lines"].append((i, line))
    entries = []
    for b in blocks:
        keys = {}
        for _, line in b["lines"]:
            k = BULLET_KEY.match(line)
            if k:
                keys[k.group(1).strip().lower()] = k.group(2).strip()
        if "status" not in keys:
            continue
        entries.append({
            "term": b["term"],
            "line": b["line"],
            "status": keys["status"].strip("` ").lower(),
            "kind": keys.get("kind"),
            "forbidden": split_names(keys["forbidden"]) if "forbidden" in keys else None,
            "code": split_names(keys.get("code", "")),
            "has_code": "code" in keys,
            "source": keys.get("source"),
            "replaced_by": keys.get("replaced by", "").strip(" `*") or None,
            "body": [(i, l) for i, l in b["lines"]
                     if not l.lstrip().startswith(">") and not (BULLET_KEY.match(l) and BULLET_KEY.match(l).group(1).strip().lower() in META_KEYS)],
        })
    return entries


def name_pattern(name):
    words = WORD.findall(re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", name))
    if not words:
        return None
    joined = r"[\s_-]*".join(re.escape(w) for w in words)
    pattern = re.compile(r"(?:(?<![A-Za-z0-9])|(?=[A-Z]))(?i:" + joined + r")(?![a-z0-9])")
    NEEDLES[pattern] = max(words, key=len).lower()
    return pattern


def corpus_files(notes, code_roots):
    files = [os.path.join(notes, "spec.md")]
    files += sorted(glob.glob(os.path.join(notes, "todos", "*.md")))
    files += sorted(glob.glob(os.path.join(notes, "thoughts", "*.md")))
    for root in code_roots:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            files += [os.path.join(dirpath, f) for f in filenames if os.path.splitext(f)[1] in CODE_EXTS]
    corpus = []
    for path in files:
        lines = read(path) if os.path.isfile(path) else None
        if lines:
            corpus.append((path, lines, "\n".join(lines).lower()))
    return corpus


def glossary_text(entries, path):
    """The definitions a reader sees: every live entry's prose, without its metadata bullets."""
    return [(path, [l for e in entries if e["status"] != "retired" for _, l in e["body"]],
             [i for e in entries if e["status"] != "retired" for i, _ in e["body"]])]


def hits(pattern, corpus, glossary_lines=None):
    found, needle = [], NEEDLES.get(pattern, "")
    for path, lines, lowered in corpus:
        if needle not in lowered:
            continue
        for n, line in enumerate(lines, 1):
            if pattern.search(line):
                found.append(f"{path}:{n}")
    if glossary_lines:
        path, lines, numbers = glossary_lines[0]
        for n, line in zip(numbers, lines):
            if pattern.search(line):
                found.append(f"{path}:{n}")
    return found


def rel(path, notes):
    return os.path.relpath(path, notes) if path.startswith(notes) else path


def check_fields(entries, f):
    row = f.check("GL1", "every entry carries Status, Kind, Forbidden, Code, Source; a retired one names its replacement")
    live = {e["term"] for e in entries if e["status"] != "retired"}
    for e in entries:
        where = f"GLOSSARY.md:{e['line']} § {e['term']}"
        if e["status"] not in STATUSES:
            f.fail(row, where, f"Status `{e['status']}` is not new, existing, or retired")
        if e["status"] == "retired":
            if not e["replaced_by"]:
                f.fail(row, where, "retired entry has no `Replaced by`", "name the entry that took its meaning, or `none`")
            elif e["replaced_by"].lower() != "none" and e["replaced_by"] not in live:
                f.fail(row, where, f"`Replaced by: {e['replaced_by']}` is not a live entry")
            continue
        if not e["kind"]:
            f.fail(row, where, "no Kind", "one word from the data or brick set")
        elif e["kind"].strip("` ").lower() not in KINDS:
            f.fail(row, where, f"Kind `{e['kind']}` is not in the data or brick set")
        if e["forbidden"] is None:
            f.fail(row, where, "no Forbidden", "write `none` when the concept has one name")
        if not e["has_code"]:
            f.fail(row, where, "no Code", "the identifiers the code spells it with, or `none` before code exists")
        if not e["source"]:
            f.fail(row, where, "no Source")


def check_forbidden_shape(entries, f):
    row = f.check("GL2", "every Forbidden name is enforceable — owned by one entry, absent from entry names and definitions")
    owners = collections.defaultdict(list)
    for e in entries:
        for name in e["forbidden"] or []:
            owners[name.lower()].append(e["term"])
    for name, terms in sorted(owners.items()):
        if len(terms) > 1:
            f.fail(row, f"Forbidden `{name}`", f"listed by {len(terms)} entries: {', '.join(terms)}",
                   "one concept owns a banned alias; drop it from the others")
    live = [e for e in entries if e["status"] != "retired"]
    definitions = " ".join(l for e in live for _, l in e["body"])
    for e in entries:
        for name in e["forbidden"] or []:
            pattern = name_pattern(name)
            if not pattern:
                continue
            inside = [o["term"] for o in live if o is not e and pattern.search(o["term"])]
            if inside:
                f.fail(row, f"GLOSSARY.md:{e['line']} § {e['term']}",
                       f"Forbidden `{name}` is part of the entry name {inside[0]}",
                       "ban the whole alias, never a word of another term")
            elif pattern.search(definitions):
                f.fail(row, f"GLOSSARY.md:{e['line']} § {e['term']}",
                       f"Forbidden `{name}` appears in the glossary's own definitions",
                       "a word the definitions need is a common word; ban the specific alias instead")


def check_banned_in_use(entries, corpus, gloss, notes, f):
    row = f.check("GL3", "no Forbidden name and no retired term is in use in the live corpus")
    banned = []
    for e in entries:
        if e["status"] == "retired":
            target = e["replaced_by"] if e["replaced_by"] and e["replaced_by"].lower() != "none" else "nothing"
            banned += [(n, f"retired, replaced by {target}") for n in [e["term"], *e["code"]]]
        else:
            banned += [(n, f"forbidden alias of {e['term']}") for n in e["forbidden"] or []]
    seen = set()
    for name, why in banned:
        if name.lower() in seen:
            continue
        seen.add(name.lower())
        pattern = name_pattern(name)
        found = hits(pattern, corpus, gloss) if pattern else []
        if found:
            shown = ", ".join(rel(h, notes) for h in found[:SHOWN_HITS])
            f.fail(row, f"`{name}`", f"{why} — {len(found)} use(s): {shown}",
                   "rename every use in the commit that banned it")


def check_code_names(entries, code_corpus, notes, f):
    row = f.check("GL4", "every Code identifier is owned by one entry, and Status matches the code")
    owners = collections.defaultdict(list)
    for e in entries:
        for name in e["code"]:
            owners[name].append(e["term"])
    for name, terms in sorted(owners.items()):
        if len(terms) > 1:
            f.fail(row, f"Code `{name}`", f"claimed by {len(terms)} entries: {', '.join(terms)}",
                   "two entries for one identifier are one concept or a naming collision")
    if not code_corpus:
        row["skipped"] = "no --code root"
        return
    for e in entries:
        where = f"GLOSSARY.md:{e['line']} § {e['term']}"
        names = e["code"] or ([e["term"]] if " " not in e["term"] else [])
        landed = [n for n in names if hits(re.compile(r"\b" + re.escape(n.split(".")[-1]) + r"\b"), code_corpus)]
        if e["status"] == "new" and landed:
            f.fail(row, where, f"Status `new` but the code declares {', '.join(landed)}",
                   "set Status `existing` in the commit that lands it")
        if e["status"] == "existing" and e["code"] and not landed:
            f.fail(row, where, f"Status `existing` but no Code identifier is in the code: {', '.join(e['code'])}",
                   "fix the Code field, or retire the entry")


def new_terms_rows(lines):
    rows, inside = [], False
    for line in lines:
        if re.match(r"^## +New terms\s*$", line):
            inside = True
            continue
        if inside and line.startswith("## "):
            break
        if inside and TABLE_ROW.match(line) and not TABLE_RULE.match(line):
            cells = [c.strip() for c in TABLE_ROW.match(line).group(1).split("|")]
            if cells and cells[0].lower() != "term":
                rows.append(cells[0].strip(" `*"))
    return rows


def check_new_terms(entries, notes, f):
    row = f.check("GL5", "every TODO `## New terms` row is a glossary entry")
    known = {e["term"].lower() for e in entries if e["status"] != "retired"}
    for path in sorted(glob.glob(os.path.join(notes, "todos", "TODO-*.md"))):
        if path.endswith((".agent.md", ".test.md")):
            continue
        for term in new_terms_rows(read(path) or []):
            if term and term.lower() not in known:
                f.fail(row, f"{rel(path, notes)} § New terms", f"`{term}` has no glossary entry",
                       "merge the row into GLOSSARY.md before the gate")


def check_dead(entries, notes_corpus, f):
    row = f.check("GL6", "every live entry is used outside the glossary")
    for e in entries:
        if e["status"] == "retired":
            continue
        names = [e["term"], *e["code"]]
        if not any(hits(name_pattern(n), notes_corpus) for n in names if name_pattern(n)):
            f.fail(row, f"GLOSSARY.md:{e['line']} § {e['term']}", "0 uses in spec.md, todos/, thoughts/",
                   "retire it, or use it where the concept appears")


def undefined_identifiers(entries, notes_corpus):
    known = {n.lower() for e in entries for n in [e["term"], *e["code"], *(e["forbidden"] or [])]}
    known |= {n.replace(" ", "").lower() for n in known}
    counts = collections.Counter()
    for _, lines, _ in notes_corpus:
        for line in lines:
            for token in BACKTICKED.findall(line):
                if not COMPOUND_TYPE.match(token) or token.startswith("Err"):
                    continue
                if token.lower() not in known:
                    counts[token] += 1
    return [(t, c) for t, c in counts.most_common(UNDEFINED_TOP) if c >= UNDEFINED_MIN_USES]


def lint(notes, code_roots=(), f=None):
    """Run every check into `f`; return (findings, entries) or (None, None) when there is no glossary."""
    f = f or Findings()
    path = os.path.join(notes, "GLOSSARY.md")
    lines = read(path)
    if lines is None:
        return None, None
    entries = parse_glossary(lines)
    notes_corpus = corpus_files(notes, [])
    code_corpus = corpus_files(notes, code_roots)[len(notes_corpus):] if code_roots else []
    gloss = glossary_text(entries, path)
    check_fields(entries, f)
    check_forbidden_shape(entries, f)
    check_banned_in_use(entries, notes_corpus + code_corpus, gloss, notes, f)
    check_code_names(entries, code_corpus, notes, f)
    check_new_terms(entries, notes, f)
    check_dead(entries, notes_corpus, f)
    return f, entries


def main(argv):
    args, code_roots, i = [], [], 0
    while i < len(argv):
        if argv[i] == "--code" and i + 1 < len(argv):
            code_roots.append(argv[i + 1])
            i += 2
            continue
        if not argv[i].startswith("--"):
            args.append(argv[i])
        i += 1
    if not args:
        print(__doc__)
        return 2
    notes = os.path.abspath(args[0])
    if not os.path.isdir(notes):
        print(f"glossary-lint: no notes dir at '{notes}'", file=sys.stderr)
        return 2
    f, entries = lint(notes, code_roots)
    if f is None:
        print(f"glossary-lint: no GLOSSARY.md in '{notes}'", file=sys.stderr)
        return 2
    undefined = undefined_identifiers(entries, corpus_files(notes, [])) if "--undefined" in argv else []

    if "--json" in argv:
        print(json.dumps({"checks": f.checks, "undefined": undefined}, indent=2))
        return 1 if f.failed else 0

    statuses = collections.Counter(e["status"] for e in entries)
    width = max(len(c["title"]) for c in f.checks) + 2
    print(f"glossary-lint {notes} — {len(entries)} entries "
          f"({', '.join(f'{v} {k}' for k, v in sorted(statuses.items()))})\n")
    for c in f.checks:
        verdict = f"n/a — {c['skipped']}" if c.get("skipped") else (
            f"{len(c['findings'])} finding(s)" if c["findings"] else "clean")
        print(f"  [{c['id']}] {c['title']:<{width}} {verdict}")
    if f.failed and "--quiet" not in argv:
        print("\nFindings\n")
        for c in f.failed:
            for hit in c["findings"]:
                remedy = f" — {hit['remedy']}" if hit["remedy"] else ""
                print(f"  [{c['id']}] {hit['where']}: {hit['message']}{remedy}")
    if undefined:
        print(f"\nUndefined identifiers (≥{UNDEFINED_MIN_USES} uses, in no entry) — report only\n")
        for token, count in undefined:
            print(f"  {token:<40} {count}")
    return 1 if f.failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
