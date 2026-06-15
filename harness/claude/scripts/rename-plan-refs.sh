#!/usr/bin/env bash
# Safe identifier-level rename of plan->spec references in given files.
# Rewrites: plan-* skill names, plan.md/plan-verify.md artifact filenames,
# /work:plan-revise command, claude-plan alias, and _notes -> .notes dir.
# Does NOT blanket-rebrand prose "plan" -> keeps planning/planner and other prose intact.
# Idempotent. Usage: rename-plan-refs.sh <file> [<file> ...]
set -euo pipefail
[ "$#" -ge 1 ] || { echo "usage: $0 <file>..." >&2; exit 1; }

for f in "$@"; do
  [ -f "$f" ] || { echo "skip (missing): $f" >&2; continue; }
  # skill cross-refs (longest first)
  for p in plan-todo-prepare:spec-todo-prepare plan-code-map:spec-code-map \
           plan-prototype:spec-prototype plan-verifier:spec-verifier \
           plan-revise:spec-revise plan-flow:spec-flow; do
    o="${p%%:*}"; n="${p##*:}"; perl -i -pe "s/\\b\\Q${o}\\E\\b/${n}/g" "$f"
  done
  # command + alias
  perl -i -pe 's{/work:plan-revise}{/work:spec-revise}g; s/\bclaude-plan\b/claude-spec/g' "$f"
  # artifact filenames
  perl -i -pe 's/\bplan-verify\.md\b/spec-verify.md/g; s/\bplan\.md\b/spec.md/g' "$f"
  # bare @plan skill mention
  perl -i -pe 's/\@plan\b(?![-\w])/\@spec/g' "$f"
  # notes dir
  perl -i -pe 's/(?<![\w.])_notes\b/.notes/g' "$f"
  echo "renamed: $f"
done
