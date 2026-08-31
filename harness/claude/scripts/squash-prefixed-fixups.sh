#!/usr/bin/env bash
# Squash fixup commits that `git rebase --autosquash` cannot see.
#
# Autosquash only matches a message STARTING with "fixup! " / "squash! ".
# A commit-msg hook that prepends a ticket tag — "[ABC-1]: fixup! ..." — hides
# the marker, so autosquash silently rebases and folds nothing.
#
# This rewrites the rebase todo itself: every commit whose subject contains
# "fixup!" anywhere becomes a `fixup` of the pick above it.
#
# Usage: squash-prefixed-fixups.sh <base-ref> [--autostash]
#   squash-prefixed-fixups.sh 5649186
#   squash-prefixed-fixups.sh 5649186 --autostash   # unrelated dirty files present
#
# Refuses to run when a fixup would be the first line of the todo (nothing to
# fold into) — that means <base-ref> is too recent.
set -euo pipefail

base=${1:?base ref required (the commit BEFORE the first pick)}
autostash=${2:-}

if [ "$autostash" != "--autostash" ] && [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "working tree dirty — rerun with --autostash, or commit first" >&2
  exit 1
fi

stash_args=()
[ "$autostash" = "--autostash" ] && stash_args=(--autostash)

editor=$(mktemp)
trap 'rm -f "$editor"' EXIT
cat >"$editor" <<'INNER'
#!/usr/bin/env bash
set -euo pipefail
todo=$1
first=1
while IFS= read -r line; do
  if [[ $line =~ ^pick[[:space:]] ]] && [[ $line == *"fixup!"* ]]; then
    if [ "$first" = 1 ]; then
      echo "first todo entry is a fixup — base ref is too recent" >&2
      exit 1
    fi
    echo "${line/#pick/fixup}"
  else
    [[ $line =~ ^pick[[:space:]] ]] && first=0
    echo "$line"
  fi
done <"$todo" >"$todo.new"
mv "$todo.new" "$todo"
INNER
chmod +x "$editor"

GIT_SEQUENCE_EDITOR="$editor" git rebase "${stash_args[@]}" -i "$base"
