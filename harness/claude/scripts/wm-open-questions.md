---
name: wm-open-questions.sh
description: List the open questions in a wm notes dir's QUESTIONS.md and exit 1 when there is at least one.
args: "[notes-dir|QUESTIONS.md] [--count|--slugs]"
needs: bash, awk
used_by: wm guard.sh, wm spec-focus.sh, wm code skill readiness gate
---
