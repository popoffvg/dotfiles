---
name: wm-constraints.py
description: Print one rule per Property of each live ADR in an adr/ dir, and check the ADRs and their Property gate files for format problems.
args: "[adr-dir|notes-dir] [-m REGEX] [--json|--check|--unapproved]"
needs: python3
used_by: wm rules gate (wm-rule-batches.py), wm guard.sh, wm spec-lint.py
---
