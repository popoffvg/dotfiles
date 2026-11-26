---
name: operator-time.py
description: Print the operator hours of one project against other org work and tooling, merged over Claude Code, Codex, Cursor, and OpenCode sessions, with the weekly share and the top other-work folders, as JSON.
args: "--folder TEXT --branch REGEX --mention REGEX [--org git/mil] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--gap 30] [--solo 5]"
needs: python3, sqlite3
used_by: project-status skill
---
