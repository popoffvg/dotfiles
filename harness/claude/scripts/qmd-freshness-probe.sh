#!/usr/bin/env bash
# qmd-freshness-probe.sh — does `qmd search` see a file added since the last index?
#
# Answers one question: is `qmd update` actually required before a newly written
# note is searchable, or does qmd pick it up on its own?
#
# Uses a throwaway collection in a temp dir. Never touches a real vault.
# Idempotent: removes the probe collection and dir on exit, even on failure.
#
# Usage:  qmd-freshness-probe.sh [collection-name]
#         ssh host 'bash -s' < qmd-freshness-probe.sh

set -uo pipefail

COLL="${1:-qmdfreshprobe}"
DIR="$(mktemp -d "${TMPDIR:-/tmp}/${COLL}.XXXXXX")"

cleanup() {
  echo "--- cleanup ---"
  qmd collection remove "$COLL" >/dev/null 2>&1 && echo "removed collection $COLL"
  rm -rf "$DIR" && echo "removed $DIR"
}
trap cleanup EXIT

note() { # note <file> <unique-token>
  printf -- '---\nid: %s\ntype: note\ntitle: %s\nstatus: draft\ncreated: 2026-01-01\n---\n\n# %s\n\nThe unique probe token is %s and it appears only here.\n' \
    "$2" "$2" "$2" "$2" > "$DIR/$1"
}

hits() { # hits <token> -> prints match count
  qmd search "$1" -c "$COLL" --files -n 5 2>/dev/null | grep -c "$COLL" || true
}

echo "=== probe dir: $DIR ==="

# 1. seed one note, then index the collection
note before.md tokenbefore
qmd collection add "$DIR" --name "$COLL" --mask '**/*.md' 2>&1 | head -3

echo
echo "=== A. token present at index time (control) ==="
echo "matches for tokenbefore: $(hits tokenbefore)   [expect >= 1]"

# 2. add a second note AFTER indexing — this is the actual test
note after.md tokenafter
sync 2>/dev/null
echo
echo "=== B. token added AFTER indexing, no qmd update (THE TEST) ==="
echo "matches for tokenafter:  $(hits tokenafter)   [0 = gap is real, >=1 = qmd self-heals]"

# 3. re-index, confirm it becomes visible
echo
echo "=== C. after qmd update ==="
qmd update >/dev/null 2>&1
echo "matches for tokenafter:  $(hits tokenafter)   [expect >= 1]"

# 4. does a plain search of an unrelated collection trigger a refresh?
echo
echo "=== D. file deleted after indexing, no update ==="
rm -f "$DIR/after.md"
echo "matches for tokenafter:  $(hits tokenafter)   [>=1 = index serves a deleted file]"
