#!/usr/bin/env bash
# go-mutation-check.sh — apply one-line mutants to Go source, run covering tests, report survivors.
#
# Usage: go-mutation-check.sh <worktree> <mutants-file>
#
# Each line of <mutants-file> is TAB-separated:
#   <label>\t<file>\t<perl-expr>\t<test-command>
# The perl expression is applied in-place to <file>; the file is restored after each run.
# A mutant is KILLED when the test command fails, SURVIVED when it passes.
set -uo pipefail

WORKTREE="${1:?usage: go-mutation-check.sh <worktree> <mutants-file>}"
MUTANTS="${2:?usage: go-mutation-check.sh <worktree> <mutants-file>}"

cd "$WORKTREE" || exit 1

survived=0
killed=0
noop=0

while IFS=$'\t' read -r label file expr testcmd; do
  [ -z "${label:-}" ] && continue
  case "$label" in \#*) continue ;; esac

  cp "$file" "$file.mutbak"
  perl -0pi -e "$expr" "$file"

  if cmp -s "$file" "$file.mutbak"; then
    echo "NO-OP     $label  (expression matched nothing — mutant never applied)"
    noop=$((noop + 1))
    mv "$file.mutbak" "$file"
    continue
  fi

  if eval "$testcmd" >/dev/null 2>&1; then
    echo "SURVIVED  $label"
    survived=$((survived + 1))
  else
    echo "killed    $label"
    killed=$((killed + 1))
  fi

  mv "$file.mutbak" "$file"
done < "$MUTANTS"

echo
echo "killed=$killed survived=$survived no-op=$noop"
[ "$survived" -eq 0 ] && [ "$noop" -eq 0 ]
