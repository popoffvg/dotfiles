#!/usr/bin/env python3
"""Format the ```ts/```typescript code blocks inside a todos/TODO-N.md file.

Code-block-only: touches nothing but fenced TypeScript blocks — the `## Changes`
pseudocode (sub-todo.md § Changes). Each block is run through prettier
`--parser typescript`; a block that fails to parse (loose pseudocode) is kept
verbatim. ```diff interface sub-blocks and all markdown are left untouched.

Prettier resolution: nearest project `node_modules/.bin/prettier` (honours the
repo's .prettierrc), else `npx --yes prettier@3`.
"""
import os
import re
import subprocess
import sys

FENCE_OPEN = re.compile(r"^```(?:ts|typescript)\s*$")


def find_prettier(start_dir):
    d = os.path.abspath(start_dir)
    while True:
        cand = os.path.join(d, "node_modules", ".bin", "prettier")
        if os.path.isfile(cand) and os.access(cand, os.X_OK):
            return [cand]
        parent = os.path.dirname(d)
        if parent == d:
            return ["npx", "--yes", "prettier@3"]
        d = parent


def is_close_fence(line):
    s = line.strip()
    return len(s) >= 3 and set(s) == {"`"}


def format_ts(code, prettier):
    try:
        p = subprocess.run(
            prettier + ["--parser", "typescript"],
            input=code,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception:
        return None
    if p.returncode != 0:
        return None  # pseudocode / unparseable → keep original
    return p.stdout


def main():
    if len(sys.argv) < 2:
        return 0
    path = sys.argv[1]
    try:
        with open(path, "r") as f:
            lines = f.readlines()
    except OSError:
        return 0

    prettier = find_prettier(os.path.dirname(path) or ".")
    out = []
    i = 0
    n = len(lines)
    changed = False

    while i < n:
        line = lines[i]
        if not FENCE_OPEN.match(line):
            out.append(line)
            i += 1
            continue

        # collect block body until the closing fence
        body = []
        j = i + 1
        while j < n and not is_close_fence(lines[j]):
            body.append(lines[j])
            j += 1
        if j >= n:  # unterminated fence — leave the rest verbatim
            out.append(line)
            i += 1
            continue

        code = "".join(body)
        formatted = format_ts(code, prettier)
        out.append(line)  # opening fence
        if formatted is not None:
            if not formatted.endswith("\n"):
                formatted += "\n"
            if formatted != code:
                changed = True
            out.append(formatted)
        else:
            out.extend(body)
        out.append(lines[j])  # closing fence
        i = j + 1

    if changed:
        with open(path, "w") as f:
            f.writelines(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
