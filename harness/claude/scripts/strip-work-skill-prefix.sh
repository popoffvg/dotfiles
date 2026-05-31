#!/usr/bin/env bash
# Strip the "work-" prefix from work-manager skill-name references in the given files.
# Uses Perl word-boundary + negative-lookahead so e.g. `work-verify-gate` (not a skill)
# and `work-next-prompt` / `work-abandon` (not renamed) are left untouched.
# Idempotent. Usage: strip-work-skill-prefix.sh <file> [<file> ...]
set -euo pipefail

# Stripped skill names (the renamed targets). Replacement = token without "work-".
TOKENS=(auto-verify commit done implement install plan-flow plan-revise plan-verifier plan research test todo-prepare verify prototype)

[ "$#" -ge 1 ] || { echo "usage: $0 <file> [<file> ...]" >&2; exit 1; }

for f in "$@"; do
  [ -f "$f" ] || { echo "skip (not a file): $f" >&2; continue; }
  for tok in "${TOKENS[@]}"; do
    # \bwork-<tok> not followed by another word char or hyphen -> <tok>
    perl -i -pe "s/\\bwork-\\Q${tok}\\E(?![-\\w])/${tok}/g" "$f"
  done
  echo "stripped: $f"
done
