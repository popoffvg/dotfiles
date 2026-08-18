#!/usr/bin/env python3
"""Split one `git diff HEAD` patch into per-commit patches, addressed by hunk id.

Three modes:

  list      --patch FULL.patch
            Parse the diff and print a JSON inventory. Every hunk gets a stable
            id (h1, h2, ...) in patch order. Those ids are the only handle the
            caller ever uses to name a hunk.

  split     --patch FULL.patch --plan PLAN.json --outdir DIR
            Write commit1.patch .. commitN.patch, plus expected.patch (all
            committed hunks against the original tree) and, when the plan drops
            anything, dropped.patch (the dropped hunks against the tree AFTER
            every commit has been applied).

  normalize --patch P.patch
            Print the patch with volatile parts removed (index lines, file
            order), so two diffs of the same content compare equal.

The parser reads and writes bytes. It never decodes, strips, or re-encodes a
line, because a context blank line in a unified diff is " \\n" and losing that
leading space corrupts the patch.
"""

import argparse
import json
import re
import sys
from pathlib import Path

HUNK_RE = re.compile(rb"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$")

# A file diff carrying any of these cannot be split hunk by hunk — it travels
# whole, into exactly one commit.
ATOMIC_MARKERS = (b"rename from ", b"rename to ", b"copy from ", b"copy to ",
                  b"GIT binary patch", b"Binary files ")


class Hunk:
    def __init__(self, hid, header, section, old_start, old_len, new_start, new_len):
        self.id = hid
        self.header = header
        self.section = section
        self.old_start = old_start
        self.old_len = old_len
        self.new_start = new_start
        self.new_len = new_len
        self.body = []

    @property
    def delta(self):
        return self.new_len - self.old_len


class FileDiff:
    def __init__(self):
        self.raw = []
        self.header = []
        self.hunks = []
        self.atomic = False
        self.path = ""
        self.old_path = ""
        self.kind = "modify"


def _strip_prefix(path, prefix):
    return path[len(prefix):] if path.startswith(prefix) else path


def _paths(diff_line):
    """Pull the a/ and b/ paths out of a `diff --git a/x b/y` line.

    A path may hold spaces, so the line cannot simply be split on them. Every
    split point is tried and the one whose two halves name the same path wins;
    a rename has no such split point and falls back to first-and-last.
    """
    text = diff_line.rstrip(b"\r\n")[len(b"diff --git "):].decode("utf-8", "surrogateescape")
    for index, char in enumerate(text):
        if char != " ":
            continue
        left, right = text[:index], text[index + 1:]
        if left.startswith("a/") and right.startswith("b/") and left[2:] == right[2:]:
            return left[2:], right[2:]
    parts = text.split(" ")
    return _strip_prefix(parts[0], "a/"), _strip_prefix(parts[-1], "b/")


def parse(data):
    """Parse a full unified diff into FileDiff objects with ids assigned."""
    lines = data.splitlines(keepends=True)
    files = []
    i, n, next_id = 0, len(lines), 1

    while i < n:
        if not lines[i].startswith(b"diff --git "):
            i += 1
            continue

        fd = FileDiff()
        start = i
        fd.old_path, fd.path = _paths(lines[i])
        fd.header.append(lines[i])
        i += 1

        # Extended headers run until the first hunk or the next file diff.
        while i < n:
            line = lines[i]
            if line.startswith(b"diff --git ") or line.startswith(b"@@ "):
                break
            if line.startswith(b"new file mode"):
                fd.kind = "add"
            elif line.startswith(b"deleted file mode"):
                fd.kind = "delete"
            if any(line.startswith(m) for m in ATOMIC_MARKERS):
                fd.atomic = True
                fd.kind = "rename" if line.startswith((b"rename from ", b"rename to ")) else "binary"
            fd.header.append(line)
            i += 1
            if line.startswith(b"+++ "):
                break

        # Binary payloads and rename bodies are consumed whole, not as hunks.
        if fd.atomic:
            while i < n and not lines[i].startswith(b"diff --git "):
                i += 1
            fd.raw = lines[start:i]
            hid = "h%d" % next_id
            next_id += 1
            fd.hunks = [Hunk(hid, b"(whole file)", b"", 0, 0, 0, 0)]
            files.append(fd)
            continue

        while i < n and lines[i].startswith(b"@@ "):
            match = HUNK_RE.match(lines[i].rstrip(b"\r\n"))
            if match is None:
                raise SystemExit("unparsable hunk header at line %d: %r" % (i + 1, lines[i]))
            old_len = int(match.group(2)) if match.group(2) is not None else 1
            new_len = int(match.group(4)) if match.group(4) is not None else 1
            # Git states a zero-length side as the line BEFORE the range, so an
            # empty side reads one lower than its real position. Store plain
            # 1-based positions here and put the convention back in render_hunk,
            # so the offset arithmetic never has two kinds of number in it.
            old_start = int(match.group(1)) + (1 if old_len == 0 else 0)
            new_start = int(match.group(3)) + (1 if new_len == 0 else 0)
            hunk = Hunk("h%d" % next_id, lines[i], match.group(5),
                        old_start, old_len, new_start, new_len)
            next_id += 1
            i += 1

            # The header's line counts say exactly how long the body is. Trusting
            # them — instead of guessing from leading characters — is what makes a
            # diff of a diff (whose content lines start with +++ or @@) parse right.
            old_seen = new_seen = 0
            while i < n and (old_seen < old_len or new_seen < new_len):
                line = lines[i]
                if line.startswith(b"\\"):
                    hunk.body.append(line)
                    i += 1
                    continue
                mark = line[:1]
                if line in (b"\n", b"\r\n"):
                    # An editor stripped the trailing space off a context line.
                    # Put it back; git apply rejects the bare newline.
                    line = b" " + line
                    mark = b" "
                if mark == b" ":
                    old_seen += 1
                    new_seen += 1
                elif mark == b"-":
                    old_seen += 1
                elif mark == b"+":
                    new_seen += 1
                else:
                    break
                hunk.body.append(line)
                i += 1

            while i < n and lines[i].startswith(b"\\"):
                hunk.body.append(lines[i])
                i += 1

            if old_seen != old_len or new_seen != new_len:
                raise SystemExit(
                    "hunk %s in %s: header claims -%d +%d, body holds -%d +%d"
                    % (hunk.id, fd.path, old_len, new_len, old_seen, new_seen))
            fd.hunks.append(hunk)

        fd.raw = lines[start:i]
        files.append(fd)

    return files


def render_hunk(hunk, old_start, new_start):
    """Rewrite a hunk header from the body, so the counts can never drift."""
    old_len = sum(1 for l in hunk.body if l[:1] in (b" ", b"-"))
    new_len = sum(1 for l in hunk.body if l[:1] in (b" ", b"+"))

    def field(start, length):
        if length == 0:
            return b"%d,0" % (start - 1)
        if length == 1:
            return b"%d" % start
        return b"%d,%d" % (start, length)

    return (b"@@ -" + field(old_start, old_len) + b" +" + field(new_start, new_len)
            + b" @@" + hunk.section + b"\n")


def render_group(files, ids, prior):
    """Render the selected hunks as one patch.

    `prior` maps a path to the (old_start, delta) pairs of every hunk an earlier
    group already applied to that file. A hunk's old_start is stated against the
    original file, so once earlier commits have shifted the file it has to move
    by the sum of the deltas that landed above it.
    """
    out = []
    for fd in files:
        selected = [h for h in fd.hunks if h.id in ids]
        if not selected:
            continue
        if fd.atomic:
            out.extend(fd.raw)
            continue

        out.extend(fd.header)
        selected.sort(key=lambda h: h.old_start)
        intra = 0
        for hunk in selected:
            old_start = hunk.old_start + sum(
                d for s, d in prior.get(fd.path, []) if s < hunk.old_start)
            new_start = old_start + intra
            out.append(render_hunk(hunk, old_start, new_start))
            out.extend(hunk.body)
            intra += hunk.delta

    data = b"".join(out)
    if data and not data.endswith(b"\n"):
        data += b"\n"
    return data


def record(prior, files, ids):
    """Fold a rendered group's line shifts into the running per-file offsets."""
    for fd in files:
        if fd.atomic:
            continue
        for hunk in fd.hunks:
            if hunk.id in ids:
                prior.setdefault(fd.path, []).append((hunk.old_start, hunk.delta))


def normalize(data):
    """Drop what legitimately differs between two diffs of the same content."""
    files = parse(data)
    out = []
    for fd in sorted(files, key=lambda f: f.path):
        for line in fd.header:
            if line.startswith(b"index "):
                continue
            out.append(line)
        if fd.atomic:
            continue
        for hunk in fd.hunks:
            out.append(render_hunk(hunk, hunk.old_start, hunk.new_start))
            out.extend(hunk.body)
    return b"".join(out)


def cmd_list(args):
    files = parse(Path(args.patch).read_bytes())
    inventory = []
    for fd in files:
        entry = {"path": fd.path, "old_path": fd.old_path, "kind": fd.kind,
                 "atomic": fd.atomic, "hunks": []}
        for hunk in fd.hunks:
            added = sum(1 for l in hunk.body if l[:1] == b"+")
            removed = sum(1 for l in hunk.body if l[:1] == b"-")
            preview = [l.rstrip(b"\r\n").decode("utf-8", "replace")
                       for l in hunk.body if l[:1] in (b"+", b"-")][:6]
            entry["hunks"].append({
                "id": hunk.id,
                "header": hunk.header.rstrip(b"\r\n").decode("utf-8", "replace"),
                "old_start": hunk.old_start, "old_len": hunk.old_len,
                "added": added, "removed": removed, "preview": preview,
            })
        inventory.append(entry)
    total = sum(len(f["hunks"]) for f in inventory)
    json.dump({"files": inventory, "hunk_count": total}, sys.stdout, indent=2)
    sys.stdout.write("\n")


def cmd_split(args):
    files = parse(Path(args.patch).read_bytes())
    plan = json.loads(Path(args.plan).read_text())
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    known = {h.id for fd in files for h in fd.hunks}
    commits = plan.get("commits", [])
    dropped = list(plan.get("dropped", []))

    seen = {}
    for index, commit in enumerate(commits, 1):
        for hid in commit.get("hunks", []):
            if hid in seen:
                raise SystemExit("hunk %s claimed by commit %d and commit %s"
                                 % (hid, index, seen[hid]))
            seen[hid] = index
    for hid in dropped:
        if hid in seen:
            raise SystemExit("hunk %s is both committed and dropped" % hid)
        seen[hid] = "dropped"

    unknown = sorted(set(seen) - known)
    if unknown:
        raise SystemExit("plan names hunks that are not in the patch: %s" % ", ".join(unknown))
    missing = sorted(known - set(seen))
    if missing:
        raise SystemExit("plan leaves hunks unassigned (commit or drop each): %s"
                         % ", ".join(missing))

    written, prior = [], {}
    for index, commit in enumerate(commits, 1):
        ids = set(commit.get("hunks", []))
        data = render_group(files, ids, prior)
        if not data:
            raise SystemExit("commit %d selects no hunks" % index)
        path = outdir / ("commit%d.patch" % index)
        path.write_bytes(data)
        record(prior, files, ids)
        touched = sorted({fd.path for fd in files if any(h.id in ids for h in fd.hunks)})
        written.append({"patch": str(path), "commit": index,
                        "message": commit.get("message", ""),
                        "hunks": sorted(ids), "files": touched})

    committed = {hid for c in commits for hid in c.get("hunks", [])}
    expected = outdir / "expected.patch"
    expected.write_bytes(render_group(files, committed, {}))

    result = {"commits": written, "expected": str(expected), "dropped": None}
    if dropped:
        path = outdir / "dropped.patch"
        path.write_bytes(render_group(files, set(dropped), prior))
        result["dropped"] = {"patch": str(path), "hunks": sorted(dropped)}

    json.dump(result, sys.stdout, indent=2)
    sys.stdout.write("\n")


def cmd_normalize(args):
    sys.stdout.buffer.write(normalize(Path(args.patch).read_bytes()))


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="mode", required=True)

    p = sub.add_parser("list", help="print a JSON inventory of hunks with stable ids")
    p.add_argument("--patch", required=True)
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("split", help="write per-commit patches from a plan")
    p.add_argument("--patch", required=True)
    p.add_argument("--plan", required=True)
    p.add_argument("--outdir", required=True)
    p.set_defaults(func=cmd_split)

    p = sub.add_parser("normalize", help="print a patch with index lines and file order removed")
    p.add_argument("--patch", required=True)
    p.set_defaults(func=cmd_normalize)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
