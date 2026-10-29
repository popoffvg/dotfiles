---
name: wm-adr-index.py
description: Print one line per ADR in a wm adr/ dir with its number, kind, status, title, and path, filtered by regex, kind, status, or TODO.
args: "[adr-dir|notes-dir] [-m REGEX] [-k KIND]... [-s STATUS]... [--todo TODO-N] [--archived] [--files|--json]"
needs: python3
used_by: wm arch and trace skills
---
