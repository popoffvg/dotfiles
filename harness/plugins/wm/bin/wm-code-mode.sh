#!/usr/bin/env bash
# wm code-mode: a branch-scoped flag for the wm `code` skill.
# Single source of truth, called from three places:
#   - PreToolUse(Skill) hook -> `mark`   (bin/code-mode-mark.sh, via $CLAUDE_PLUGIN_ROOT)
#   - SessionStart hook      -> `check`  (bin/code-mode-session.sh, via $CLAUDE_PLUGIN_ROOT)
#   - user statusline        -> `status` (~/.claude/statusline-command.sh, via repo path)
#
# Model: invoking `/code` records the current branch name as the code-mode
# "slug" in <repo>/.notes/code-mode. Code mode is ENABLED whenever the current
# branch name CONTAINS that slug (substring) — so it stays on across the branch
# and any descendant branch that keeps the slug, and turns off on `main`.
#
# Subcommands (each takes an optional cwd, default $PWD):
#   mark <cwd>    record current branch as the code-mode slug
#   check <cwd>   exit 0 if code mode enabled, else 1  (silent)
#   status <cwd>  print a status-bar segment when enabled, else nothing
set -euo pipefail

# Current branch name for <dir>; echo the name or nothing (detached HEAD -> none).
# symbolic-ref works on an unborn branch (fresh repo, no commits) where
# `rev-parse --abbrev-ref HEAD` would print the literal "HEAD".
current_branch() {
  local dir="$1" b
  b=$(git -C "$dir" symbolic-ref --short HEAD 2>/dev/null) \
    || b=$(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null) \
    || return 1
  [[ -z "$b" || "$b" == "HEAD" ]] && return 1
  printf '%s' "$b"
}

# Walk up from <dir> to the nearest existing .notes; echo its path or nothing.
resolve_notes() {
  local dir="$1" parent
  while :; do
    [[ -d "$dir/.notes" ]] && { printf '%s' "$dir/.notes"; return 0; }
    parent=$(dirname "$dir")
    [[ "$parent" == "$dir" ]] && return 1
    dir="$parent"
  done
}

cmd="${1:-}"
cwd="${2:-$PWD}"
[[ -d "$cwd" ]] || exit 0

case "$cmd" in
  mark)
    branch=$(current_branch "$cwd") || exit 0
    notes=$(resolve_notes "$cwd") || notes=""
    if [[ -z "$notes" ]]; then
      root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0
      notes="$root/.notes"
      mkdir -p "$notes" || exit 0
    fi
    printf '%s\n' "$branch" >"$notes/code-mode"
    ;;
  check)
    notes=$(resolve_notes "$cwd") || exit 1
    marker="$notes/code-mode"
    [[ -f "$marker" ]] || exit 1
    slug=$(head -1 "$marker" 2>/dev/null | tr -d '[:space:]')
    [[ -n "$slug" ]] || exit 1
    branch=$(current_branch "$cwd") || exit 1
    [[ "$branch" == *"$slug"* ]] || exit 1
    exit 0
    ;;
  status)
    if "$0" check "$cwd"; then
      printf 'CODE'
    fi
    ;;
  *)
    echo "usage: wm-code-mode.sh {mark|check|status} [cwd]" >&2
    exit 2
    ;;
esac
exit 0
