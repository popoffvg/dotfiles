#!/usr/bin/env python3
"""List every symbol that exists at the base of a change and changes at its tip (Go, Rust, JS, TS).

A row is one existing symbol: removed, with a new signature, with a new body,
or a new member (a field, a method) of a type that exists at the base.
A symbol that only the change adds, in a new type or a new file, has no row.
"""
import argparse
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

WORKTREE_TIP = "worktree"
SCANNER_PATH = Path(__file__).resolve().parent / "wm-spec-code-names.py"
# Report order: the change that breaks the most callers first.
CHANGES = ["removed", "signature", "body", "added"]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("base", help="the base revision")
    parser.add_argument("tip", nargs="?", default=WORKTREE_TIP, help="the tip revision, or 'worktree' (default)")
    parser.add_argument("--repo", default=".", help="the git checkout (default: the cwd)")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    scanner = load_scanner()
    repo = Path(args.repo).resolve()
    paths = changed_paths(repo, args.base, args.tip)
    scanned_extensions = {ext for _, exts, *_ in scanner.DECLARATIONS for ext in exts}
    scanned = [p for p in paths if Path(p).suffix in scanned_extensions]
    unscanned = [p for p in paths if Path(p).suffix not in scanned_extensions]
    with tempfile.TemporaryDirectory() as scratch:
        before = declarations_at(scanner, repo, args.base, scanned, Path(scratch) / "base")
        after = declarations_at(scanner, repo, args.tip, scanned, Path(scratch) / "tip")
    rows = symbol_changes(scanner, before, after)

    if args.json:
        print(json.dumps({"changes": rows, "unscanned": unscanned}, indent=2))
        return 0
    print("| Change | Symbol | Kind | At | Before | After |")
    print("|---|---|---|---|---|---|")
    for row in rows:
        print(f"| {row['change']} | `{row['symbol']}` | {row['kind']} | {row['at']} | "
              f"{code_cell(row['before'])} | {code_cell(row['after'])} |")
    if unscanned:
        print(f"\nUnscanned files (no parser for the language): {', '.join(unscanned)}")
    return 0


def load_scanner():
    spec = importlib.util.spec_from_file_location("wm_spec_code_names", SCANNER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def changed_paths(repo: Path, base: str, tip: str) -> list[str]:
    revisions = [base] if tip == WORKTREE_TIP else [base, tip]
    listed = subprocess.run(["git", "-C", str(repo), "diff", "--name-only", *revisions], capture_output=True, text=True)
    if listed.returncode != 0:
        sys.exit(f"changed-symbols: git diff {' '.join(revisions)} failed: {listed.stderr.strip()}")
    return listed.stdout.split()


def declarations_at(scanner, repo: Path, revision: str, paths: list[str], dest: Path) -> list:
    """Write each path as it is at the revision under dest, and scan the copies."""
    written = []
    for path in paths:
        text = file_at(repo, revision, path)
        if text is None:
            continue
        copy = dest / path
        copy.parent.mkdir(parents=True, exist_ok=True)
        copy.write_text(text)
        written.append(path)
    return scanner.scan(written, dest) if written else []


def file_at(repo: Path, revision: str, path: str) -> str | None:
    if revision == WORKTREE_TIP:
        target = repo / path
        return target.read_text(errors="replace") if target.exists() else None
    shown = subprocess.run(["git", "-C", str(repo), "show", f"{revision}:{path}"], capture_output=True, text=True)
    return shown.stdout if shown.returncode == 0 else None


def symbol_changes(scanner, before: list, after: list) -> list[dict]:
    old_by_key, new_by_key = by_key(before), by_key(after)
    base_scopes = {(d.path, d.name) for d in before if d.kind in scanner.SCOPE_LABELS}
    rows = []
    for key in old_by_key.keys() | new_by_key.keys():
        old, new = old_by_key.get(key, []), new_by_key.get(key, [])
        change = change_of(scanner, old, new, base_scopes)
        if change:
            rows.append(row_of(change, old, new))
    rows.sort(key=lambda r: (CHANGES.index(r["change"]), r["at"]))
    return rows


def by_key(declarations: list) -> dict:
    grouped = {}
    for decl in declarations:
        grouped.setdefault((decl.path, decl.scope, decl.name, decl.kind), []).append(decl)
    return grouped


def change_of(scanner, old: list, new: list, base_scopes: set) -> str | None:
    if not new:
        return "removed"
    if not old:
        member = new[0]
        return "added" if (member.path, member.scope) in base_scopes else None
    if sorted(d.signature for d in old) != sorted(d.signature for d in new):
        return "signature"
    if new[0].kind in scanner.SCOPE_LABELS:
        return None
    if sorted(squeezed(d.text) for d in old) != sorted(squeezed(d.text) for d in new):
        return "body"
    return None


def squeezed(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def row_of(change: str, old: list, new: list) -> dict:
    shown = (new or old)[0]
    return {
        "change": change,
        "symbol": f"{shown.scope}.{shown.name}" if shown.scope else shown.name,
        "kind": shown.kind,
        "at": f"{shown.path}:{shown.line}",
        "before": old[0].signature if old else "",
        "after": new[0].signature if new else "",
    }


def code_cell(signature: str) -> str:
    escaped = signature.replace("|", "\\|")
    return f"`{escaped}`" if signature else ""


if __name__ == "__main__":
    sys.exit(main())
