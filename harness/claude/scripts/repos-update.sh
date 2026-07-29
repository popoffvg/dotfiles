#!/usr/bin/env bash
# Fetch + fast-forward-only pull every clean git repo under a root.
# Skips repos with a dirty working tree, no upstream, or local commits ahead.
# Never merges, never rebases, never discards work.
# Usage: repos-update.sh <root-dir> [out.tsv]
set -uo pipefail

ROOT="${1:?root dir required}"
OUT="${2:-/dev/stdout}"

# platforma-open / milaboratory org repos: force HTTPS so gh's token is used
# instead of the SSH key (which authenticates as the wrong account).
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf
export GIT_CONFIG_VALUE_0=git@github.com:

{
printf 'repo\tstatus\told\tnew\tnew_commits\n'
for d in "$ROOT"/*/; do
  n="$(basename "$d")"
  [ -d "$d/.git" ] || continue

  old="$(git -C "$d" rev-parse --short HEAD 2>/dev/null)"

  if [ -n "$(git -C "$d" status --porcelain 2>/dev/null)" ]; then
    printf '%s\tSKIP_DIRTY\t%s\t%s\t0\n' "$n" "$old" "$old"; continue
  fi
  if ! git -C "$d" rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    printf '%s\tSKIP_NO_UPSTREAM\t%s\t%s\t0\n' "$n" "$old" "$old"; continue
  fi

  if ! git -C "$d" fetch --quiet --prune origin 2>/dev/null; then
    printf '%s\tFETCH_FAILED\t%s\t%s\t0\n' "$n" "$old" "$old"; continue
  fi

  up="$(git -C "$d" rev-parse --abbrev-ref --symbolic-full-name '@{u}')"
  read -r behind ahead <<<"$(git -C "$d" rev-list --left-right --count "$up...HEAD" 2>/dev/null || echo '0 0')"

  if [ "${ahead:-0}" -gt 0 ]; then
    printf '%s\tSKIP_AHEAD\t%s\t%s\t0\n' "$n" "$old" "$old"; continue
  fi
  if [ "${behind:-0}" -eq 0 ]; then
    printf '%s\tUP_TO_DATE\t%s\t%s\t0\n' "$n" "$old" "$old"; continue
  fi

  if git -C "$d" merge --ff-only --quiet "$up" 2>/dev/null; then
    new="$(git -C "$d" rev-parse --short HEAD)"
    printf '%s\tUPDATED\t%s\t%s\t%s\n' "$n" "$old" "$new" "$behind"
  else
    printf '%s\tFF_FAILED\t%s\t%s\t%s\n' "$n" "$old" "$old" "$behind"
  fi
done
} > "$OUT"
