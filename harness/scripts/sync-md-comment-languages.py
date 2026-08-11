#!/usr/bin/env python3
"""Regenerate the `languages` array of md-comment's language-server entry.

Zed's `extension.toml` has no wildcard: a language server attaches only to the language
names listed in `[language_servers.<id>] languages`. md-comment annotates lines, which
every language has, so the list has to name every language Zed knows on this machine.

Two sources, both read at run time:

* the languages compiled into Zed, kept in BUILT_IN below;
* the languages of every installed Zed extension, read from their `config.toml` files.

Re-run after installing a language extension, otherwise md-comment stays silent in those
files.
"""

import argparse
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MANIFEST = REPO / "harness" / "apps" / "md-comment" / "extension.toml"
SERVER_SECTION = "[language_servers.md-comment-language-server]"

# `name` of every config.toml under crates/grammars/src/ in zed-industries/zed.
# Markdown-Inline, JSDoc and Regex are injected sub-languages with no file of their own,
# and Zed Keybind Context only exists inside the keymap editor — none can hold a comment.
BUILT_IN = [
    "C",
    "C++",
    "CSS",
    "Diff",
    "Git Commit",
    "Go",
    "Go Mod",
    "Go Work",
    "JSON",
    "JSONC",
    "JavaScript",
    "Markdown",
    "Python",
    "Rust",
    "Shell Script",
    "TSX",
    "TypeScript",
    "YAML",
]

NAME = re.compile(r'^\s*name\s*=\s*"([^"]+)"', re.MULTILINE)


def extension_dirs() -> list[Path]:
    """Where Zed unpacks installed extensions, per platform."""
    home = Path.home()
    candidates = [
        home / "Library" / "Application Support" / "Zed" / "extensions" / "installed",
        Path(os.environ.get("XDG_DATA_HOME", home / ".local" / "share"))
        / "zed"
        / "extensions"
        / "installed",
    ]
    return [path for path in candidates if path.is_dir()]


def installed_languages() -> set[str]:
    """The `name` of every language every installed extension declares."""
    found = set()
    for root in extension_dirs():
        for config in root.glob("*/languages/*/config.toml"):
            match = NAME.search(config.read_text(encoding="utf-8", errors="replace"))
            if match:
                found.add(match.group(1))
    return found


def render(names: list[str]) -> str:
    body = "\n".join(f'  "{name}",' for name in names)
    return f"languages = [\n{body}\n]\n"


def replace_languages(manifest: str, block: str) -> str:
    """Swap the `languages = [...]` array inside the server section for `block`."""
    start = manifest.index(SERVER_SECTION)
    array = re.compile(r"^languages = \[[^\]]*\]\n", re.MULTILINE)
    match = array.search(manifest, start)
    if not match:
        raise SystemExit(f"no `languages` array after {SERVER_SECTION} in {MANIFEST}")
    return manifest[: match.start()] + block + manifest[match.end() :]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit non-zero when the manifest is out of date, and write nothing",
    )
    args = parser.parse_args()

    names = sorted(set(BUILT_IN) | installed_languages(), key=str.lower)
    manifest = MANIFEST.read_text(encoding="utf-8")
    updated = replace_languages(manifest, render(names))

    if updated == manifest:
        print(f"up to date — {len(names)} languages")
        return 0
    if args.check:
        print(f"out of date — {len(names)} languages available", file=sys.stderr)
        return 1
    MANIFEST.write_text(updated, encoding="utf-8")
    print(f"wrote {len(names)} languages to {MANIFEST.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
