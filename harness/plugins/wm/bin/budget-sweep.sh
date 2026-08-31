#!/usr/bin/env bash
# Count every spec artifact in one notes dir against its budgets, in one call.
#
# budget-check.py takes one file. The write-time hook has one file to give it and only
# warns; the `verify` gate has a whole corpus and must fail on any overrun. This is that
# second caller: spec.md, CONSTRAINTS.md, and both halves of every ledger row.
#
# usage: budget-sweep.sh <notes-dir>
# Exit code: 0 every artifact within budget - 1 at least one over - 2 unusable notes dir.
set -euo pipefail

NOTES=${1:-}
if [[ -z "$NOTES" || ! -d "$NOTES" ]]; then
  echo "budget-sweep: no notes dir at '${NOTES:-<missing argument>}'" >&2
  exit 2
fi

ROOT=${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
CHECK="$ROOT/bin/budget-check.py"
if [[ ! -f "$CHECK" ]]; then
  echo "budget-sweep: no budget-check.py at $CHECK" >&2
  exit 2
fi

shopt -s nullglob
CANDIDATES=("$NOTES/spec.md" "$NOTES/CONSTRAINTS.md" "$NOTES"/todos/TODO-*.md)
shopt -u nullglob

OVER=0
SEEN=0
for file in "${CANDIDATES[@]+"${CANDIDATES[@]}"}"; do
  [[ -f "$file" ]] || continue
  SEEN=$((SEEN + 1))
  python3 "$CHECK" "$file" || OVER=1
done

((OVER == 0)) && echo "budget-sweep: $SEEN artifact(s) within budget."
exit "$OVER"
