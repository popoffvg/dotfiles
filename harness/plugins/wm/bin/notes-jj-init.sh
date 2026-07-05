#!/usr/bin/env bash
# SessionStart hook: analyze .notes and initialize its jj repo if missing.
# The .notes dir is its own standalone jj repo (git-ignored in the parent),
# so the spec history lives in `jj log` instead of a hand-kept worklog.md.
# Walks up from cwd to find .notes (same as notes-locate.sh). No-op when:
# jj is absent, no .notes exists, or .notes/.jj already present.
set -euo pipefail

command -v jj >/dev/null 2>&1 || exit 0

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null) || exit 0
[[ -z "$CWD" || ! -d "$CWD" ]] && exit 0

dir="$CWD"
notes=""
while :; do
  [[ -d "$dir/.notes" ]] && { notes="$dir/.notes"; break; }
  parent=$(dirname "$dir")
  [[ "$parent" == "$dir" ]] && break
  dir="$parent"
done
[[ -z "$notes" ]] && exit 0
[[ -d "$notes/.jj" ]] && exit 0   # already initialized

# Standalone per-notes jj repo (its own git backend, not colocated with parent).
jj git init "$notes" >/dev/null 2>&1 || exit 0

# Ignore .notes in the parent repo via a local (uncommitted) gitignore.
root=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || root=""
if [[ -n "$root" ]]; then
  ignore="$root/.gitignore.local"
  grep -qxF '.notes/' "$ignore" 2>/dev/null || echo '.notes/' >>"$ignore"
  # Wire excludesFile only if unset locally — don't clobber an existing one.
  # ponytail: if they already point core.excludesFile elsewhere, the .notes/
  # line above won't apply; rare, and they can add it to their own file.
  current=$(git -C "$root" config --local core.excludesFile 2>/dev/null || true)
  [[ -z "$current" ]] && git -C "$root" config --local core.excludesFile "$ignore" 2>/dev/null || true
fi

echo "wm: initialized jj repo at $notes (spec history: jj log). .notes/ ignored in parent."
exit 0
