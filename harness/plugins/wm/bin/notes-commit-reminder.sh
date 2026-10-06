#!/usr/bin/env bash
# Stop hook: when the notes jj repo has uncommitted changes, block the stop once
# and tell the agent to commit them with a why-message. On the second stop of the
# same turn (stop_hook_active) the agent did not commit, so notes-jj-commit.sh
# commits the rest under a file-list message.
set -euo pipefail

command -v jj >/dev/null 2>&1 || exit 0

INPUT=$(cat)
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

active=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null) || active=false
if [[ "$active" == "true" ]]; then
  echo "$INPUT" | "$here/notes-jj-commit.sh"
  exit 0
fi

CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null) || exit 0
[[ -z "$CWD" || ! -d "$CWD" ]] && exit 0

# shellcheck source=notes-store.sh
source "$here/notes-store.sh"
notes=$(notes_find_dir "$CWD") || exit 0

diff=$(jj -R "$notes" diff -s 2>/dev/null) || exit 0
[[ -z "$diff" ]] && exit 0

files=$(echo "$diff" | awk '{print $2}' | head -10 | paste -sd, - | sed 's/,/, /g')
reason="wm: uncommitted changes in $notes ($files). Commit them now: jj -R \"$notes\" commit -m \"<phase>: <main ideas>\". The message says why, not which files. If you stop again without a commit, the hook commits them under a file-list message."
jq -n --arg r "$reason" '{decision: "block", reason: $r}'
