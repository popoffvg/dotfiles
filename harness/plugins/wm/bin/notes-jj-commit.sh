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
diff=$(jj -R "$notes" diff -s 2>/dev/null)
[[ -z "$diff" ]] && exit 0

# Fallback only: phases commit intentful "<phase>: <why>" messages themselves
# (see references/jj-notes.md). This catches work left uncommitted at session
# end — it can't know intent, so it names the changed basenames (capped).
# jj diff -s lines are "<op> <path>"; take the paths, basename, unique.
names=$(echo "$diff" | awk '{print $2}' | xargs -n1 basename 2>/dev/null | sort -u)
count=$(echo "$names" | grep -c .)
list=$(echo "$names" | head -6 | paste -sd, - | sed 's/,/, /g')
[[ "$count" -gt 6 ]] && list="$list, +$((count - 6)) more"
jj -R "$notes" commit -m "session end (uncommitted): $list" >/dev/null 2>&1 || true
exit 0
