---
name: changed-symbols.py
description: List every Go, Rust, JS, or TS symbol that exists at the base of a change and that the tip removes, gives a new signature or body, or gives a new field or method.
args: "<base> [tip|worktree] [--repo DIR] [--json]"
needs: python3, ast-grep, wm-spec-code-names.py in the same directory
used_by: tour-v2 (tour check), wm impl (Not in the pair), wm verifier
---
