---
name: wm-constraints.py
description: Print one rule per Property of each live accepted ADR in a wm adr/ dir, and check the ADRs for format problems.
args: "[adr-dir|notes-dir] [-m REGEX] [--todo TODO-N] [--json|--check]"
needs: python3
used_by: wm rules gate (wm-rule-batches.py), wm guard.sh, wm spec-lint.py
---
