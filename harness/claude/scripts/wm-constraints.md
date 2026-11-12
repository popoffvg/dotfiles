---
name: wm-constraints.py
description: Print one rule per Property of each live ADR in an adr/ dir, write the rules as a reviewrules rule dir, and check the ADRs and their Property gate files for format problems.
args: "[adr-dir|notes-dir] [-m REGEX] [--json|--check|--unapproved|--reviewrules]"
needs: python3
used_by: wm review skill (--reviewrules), wm guard.sh, wm spec-lint.py
---
