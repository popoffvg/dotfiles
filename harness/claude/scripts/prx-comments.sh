#!/usr/bin/env bash
# Carry the inline notes of one PR review across `prx` runs.
#
# A Hunk session holds its notes in memory and drops them when the window closes, so the
# review-focus extension mirrors every saved note into comments.json keyed by the PR. This
# script is the other half: it puts them back into a fresh session and drops the ones the PR
# already carries.
#
# Posting is not here. `S` (hunk-gh-review) submits the live session as one atomic review and
# clears what it submitted, which drops those notes from this store through the extension's
# note_changed handler.
set -euo pipefail

store="${XDG_STATE_HOME:-$HOME/.local/state}/review-focus/comments.json"

usage() {
  cat <<'EOF'
Usage:
  prx-comments.sh count   <key>                    saved notes for this PR
  prx-comments.sh restore <key> <worktree>         wait for the session, put them back
  prx-comments.sh prune   <key> <owner/repo> <n>   drop the ones already on the PR
  prx-comments.sh clear   <key>

<key> is the PR the notes belong to, "<owner>/<repo>#<number>" — the same value prx exports
as PRX_REVIEW_KEY so the extension writes under it.
EOF
}

saved() {
  [[ -f $store ]] || { echo '[]'; return; }
  jq -c --arg key "$1" '[(.reviews[$key] // {}) | to_entries[] | .value]' "$store"
}

rewrite_store() {
  local key="$1" filter="$2" scratch
  shift 2
  [[ -f $store ]] || return 0
  scratch=$(mktemp "${store}.XXXXXX")
  jq --arg key "$key" "$@" "$filter" "$store" >"$scratch" && mv "$scratch" "$store"
}

case "${1:-}" in
count)
  saved "${2:?key}" | jq 'length'
  ;;

restore)
  key="${2:?key}"
  worktree="${3:?worktree}"
  # `author` is the marker the forked hunk-gh-review submits on: nothing outside the TUI can
  # create a `user` note, so a restored note arrives as `source: "agent"` and would otherwise
  # be indistinguishable from a review gate's finding — and unpostable by `S`.
  payload=$(saved "$key" | jq -c '{
    comments: [.[] | {filePath, summary, author: "prx-restored"} + (if .side == "old" then {oldLine: .line} else {newLine: .line} end)]
  }')
  [[ $(jq '.comments | length' <<<"$payload") -gt 0 ]] || exit 0
  # The session registers with the daemon a moment after Hunk starts, so the caller launches
  # this alongside Hunk rather than before it.
  for _ in $(seq 1 40); do
    if hunk session get --repo "$worktree" --json >/dev/null 2>&1; then
      printf '%s' "$payload" | hunk session comment apply --repo "$worktree" --stdin >/dev/null
      exit 0
    fi
    sleep 0.5
  done
  echo "prx-comments: no session for $worktree — $(jq 'length' <<<"$(saved "$key")") note(s) stay saved" >&2
  exit 1
  ;;

prune)
  key="${2:?key}"
  nwo="${3:?owner/repo}"
  number="${4:?pr number}"
  posted=$(gh api "repos/${nwo}/pulls/${number}/comments" --paginate \
    --jq '[.[] | {path, line: (.line // .original_line), body}]' 2>/dev/null | jq -sc 'add // []') || posted='[]'
  rewrite_store "$key" '
    .reviews[$key] //= {}
    | .reviews[$key] |= with_entries(
        .value as $note
        | select(($posted | any(.path == $note.filePath and .line == $note.line and .body == $note.summary)) | not))
    | if (.reviews[$key] | length) == 0 then del(.reviews[$key]) else . end
  ' --argjson posted "$posted"
  ;;

clear)
  rewrite_store "${2:?key}" 'del(.reviews[$key])'
  ;;

*)
  usage
  exit 2
  ;;
esac
