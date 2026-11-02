"""Print each Property of an ADR section as `P<n>. <Property cell>`, from the table or a legacy list."""
import re
import sys

ROW = re.compile(r"^\|\s*P(\d+)\.?\s*\|((?:[^|\\]|\\.)*)\|")
ITEM = re.compile(r"^- P(\d+)\.\s*(.*)$")

for line in open(sys.argv[1], encoding="utf-8"):
    m = ROW.match(line.strip()) or ITEM.match(line.strip())
    if m:
        print(f"P{m.group(1)}. {m.group(2).strip()}")
