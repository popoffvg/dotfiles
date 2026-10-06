---
name: wm-rule-batches.py
description: Split the rule files in <notes-dir>/rules/ and ~/.notes/rules/ into one rule per H1, cut a diff into batches of one changed file and up to six rules, and check that every planned (file, rule) pair got a verdict.
args: "rules [--notes-dir DIR] [--todo TODO-N] | plan [--notes-dir DIR] [--todo TODO-N] --range <worktree|range> --out DIR [--repo DIR] [--batch-size N] | check --out DIR"
needs: python3, git
used_by: wm review skill (rules gate), wm rule-reducer agent
---
