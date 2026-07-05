#!/usr/bin/env bash
# Stop hook: snapshot the .notes jj repo at session end so the spec history is
# saved without each phase committing by hand. Per-skill scoped: only acts when
# a .notes/.jj repo exists (walks up from cwd, same as notes-locate.sh).
# No-op when: jj absent, no .notes/.jj, or the working copy has no changes.
set -euo pipefail

command -v jj >/dev/null 2>&1 || exit 0

INPUT=$(cat)
# Avoid the Stop -> respond -> Stop loop (this hook writes nothing the agent
# needs to react to, but guard anyway to match the plugin convention).
active=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null) || active=false
[[ "$active" == "true" ]] && exit 0
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null) || exit 0
[[ -z "$CWD" || ! -d "$CWD" ]] && exit 0

dir="$CWD"
notes=""
while :; do
  [[ -d "$dir/.notes/.jj" ]] && { notes="$dir/.notes"; break; }
  parent=$(dirname "$dir")
  [[ "$parent" == "$dir" ]] && break
  dir="$parent"
done
[[ -z "$notes" ]] && exit 0

# jj auto-snapshots the working copy on any command; skip if nothing changed
# to avoid empty commits.
[[ -z "$(jj -R "$notes" diff -s 2>/dev/null)" ]] && exit 0

jj -R "$notes" commit -m "session $(date '+%Y-%m-%d %H:%M'): notes snapshot" >/dev/null 2>&1 || true
exit 0
