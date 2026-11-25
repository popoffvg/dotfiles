---
name: pre-push-check.sh
description: Run the repo linter and reviewrules over the diff from the PR base to HEAD, and on success write the stamp that the pre-push-gate hook needs before a push.
args: "[--repo DIR] [--base REF] [--lint CMD] [--skip-review REASON] [--context NOTE]... | --print-stamp"
needs: git, reviewrules, jq
used_by: hooks/pre-push-gate.sh
---
