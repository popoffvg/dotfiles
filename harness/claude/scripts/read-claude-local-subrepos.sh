#!/usr/bin/env bash
# read-claude-local-subrepos.sh — SessionStart hook.
# Find every git repo (incl. worktrees) under the session cwd and emit each
# repo's CLAUDE.local.md to stdout as additional context.
#
# Detection: any `.git` entry — a directory (normal repo) or a file (worktree /
# submodule gitlink). Prunes heavy dirs (node_modules, .venv, vendor, etc.).
set -euo pipefail

root="${1:-$PWD}"

# SessionStart passes JSON on stdin: {"cwd": "...", ...}. Prefer its cwd.
if [ ! -t 0 ]; then
  input="$(cat || true)"
  if [ -n "${input:-}" ]; then
    if command -v jq >/dev/null 2>&1; then
      cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)"
    else
      cwd="$(printf '%s' "$input" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
    fi
    [ -n "${cwd:-}" ] && [ -d "$cwd" ] && root="$cwd"
  fi
fi

[ -d "$root" ] || exit 0

# Find .git entries (dir or file), pruning noise dirs. Repo root = its parent.
mapfile -t gitentries < <(
  find "$root" \
    \( -name node_modules -o -name .venv -o -name venv -o -name vendor \
       -o -name target -o -name dist -o -name build -o -name .cache \) -prune -o \
    -name .git -print 2>/dev/null
)

emitted=0
declare -A seen
for g in "${gitentries[@]}"; do
  repo="$(dirname "$g")"
  [ -n "${seen[$repo]:-}" ] && continue
  seen[$repo]=1
  local_md="$repo/CLAUDE.local.md"
  [ -f "$local_md" ] || continue
  if [ "$emitted" -eq 0 ]; then
    printf 'CLAUDE.local.md files found in git repos under %s:\n\n' "$root"
  fi
  printf '===== %s =====\n' "$local_md"
  cat "$local_md"
  printf '\n\n'
  emitted=$((emitted + 1))
done

exit 0
