#!/usr/bin/env python3
"""Exact multi-line literal replacement in a text file. Usage: md-replace.py <file> <old-file> <new-file>
Fails loudly when the old text is absent or appears more than once."""
import sys, pathlib
target, oldf, newf = (pathlib.Path(p) for p in sys.argv[1:4])
text = target.read_text()
old, new = oldf.read_text(), newf.read_text()
old = old[:-1] if old.endswith("\n") and not new.endswith("\n") else old
n = text.count(old)
if n != 1:
    sys.exit(f"FAIL {target}: old text found {n} times")
target.write_text(text.replace(old, new))
print(f"ok {target}")
