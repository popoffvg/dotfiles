#!/usr/bin/env bash
# rename-token.sh — literal, case-explicit token replacement across files.
#
# Usage:
#   rename-token.sh --pair OLD:NEW [--pair OLD2:NEW2 ...] FILE [FILE ...]
#
# Each --pair is a literal substring replacement applied in order to every FILE.
# Replacements are literal (no regex), so distinct tokens like "nanooidc" and
# "nanoidp" never collide. Idempotent: re-running after OLD is gone is a no-op.
#
# Example:
#   rename-token.sh --pair nanooidc:oidcstub --pair NANOOIDC:OIDCSTUB \
#       --pair NanoOIDC:OIDCStub a.md b.md
set -euo pipefail

pairs=()
files=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pair) pairs+=("$2"); shift 2 ;;
    *)      files+=("$1"); shift ;;
  esac
done

if [[ ${#pairs[@]} -eq 0 || ${#files[@]} -eq 0 ]]; then
  echo "usage: rename-token.sh --pair OLD:NEW [--pair ...] FILE [FILE ...]" >&2
  exit 2
fi

total=0
for f in "${files[@]}"; do
  [[ -f "$f" ]] || { echo "skip (not a file): $f" >&2; continue; }
  for p in "${pairs[@]}"; do
    old="${p%%:*}"; new="${p#*:}"
    OLD="$old" NEW="$new" perl -i -pe 's/\Q$ENV{OLD}\E/$ENV{NEW}/g' "$f"
  done
  n=0
  for p in "${pairs[@]}"; do
    old="${p%%:*}"
    n=$((n + $(grep -o "${old%%:*}" "$f" 2>/dev/null | wc -l | tr -d ' ' || true)))
  done
  echo "$f: residual old-token hits = $n"
  total=$((total + n))
done
echo "done; total residual old-token hits across files = $total"
