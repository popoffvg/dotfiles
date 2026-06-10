#!/usr/bin/env bash
# commit-index-refresh.sh — dump new first-parent commits from pl + platforma
# to per-commit JSON, then (re)build the cocoindex commit-example index.
#
# Idempotent: a commit whose JSON already exists is skipped. cocoindex skips
# unchanged files on its side too (memoized), so re-running is cheap.
#
# Decisions: grill-me session (see engram). Repos are TOP-LEVEL in the
# workspace (~/Documents/git/mil/{pl,platforma}), not under core/.
set -euo pipefail

WORKSPACE="${COMMIT_INDEX_WORKSPACE:-$HOME/Documents/git/mil}"
DUMP_DIR="${COMMIT_INDEX_DUMP:-$HOME/.cache/commit-index}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLOW="$SCRIPT_DIR/commit-index/flow.py"
PY="${COMMIT_INDEX_PY:-$HOME/.local/share/uv/tools/cocoindex-code/bin/python}"
MAX_COMMITS="${COMMIT_INDEX_MAX:-2000}"   # cap per repo on first backfill

REPOS=(pl platforma)
US=$'\x1f'   # unit separator between fields
RS=$'\x1e'   # record separator between commits

strip_trailers() {
  # drop Co-authored-by / Signed-off-by / Reviewed-by trailers + blank lines.
  # sed (not grep) so empty input still exits 0 under `set -o pipefail`.
  sed -E '/^(Co-authored-by|Signed-off-by|Reviewed-by):/Id; /^[[:space:]]*$/d'
}

dump_repo() {
  local name="$1" repo="$WORKSPACE/$1" out="$DUMP_DIR/$1"
  mkdir -p "$out"
  if [[ ! -d "$repo/.git" ]]; then
    echo "[skip] $name: not a git repo at $repo" >&2; return
  fi
  local branch
  branch="$(git -C "$repo" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo main)"
  branch="${branch#origin/}"

  local new=0 skip=0
  while IFS= read -r -d "$RS" rec; do
    rec="${rec#$'\n'}"                       # git inserts \n between commits
    [[ -z "${rec//[$'\n\r ']/}" ]] && continue
    # US-delimited fields; body is the remainder (may span newlines)
    sha="${rec%%"$US"*}";       rec="${rec#*"$US"}"
    author="${rec%%"$US"*}";    rec="${rec#*"$US"}"
    date="${rec%%"$US"*}";      rec="${rec#*"$US"}"
    subject="${rec%%"$US"*}";   body="${rec#*"$US"}"
    [[ -z "$sha" ]] && continue
    local f="$out/$sha.json"
    if [[ -f "$f" ]]; then skip=$((skip+1)); continue; fi
    local files clean_body
    # log -1 --first-parent so merge commits report the files the PR changed
    # (diff-tree --first-parent yields nothing on merges)
    files="$(git -C "$repo" log -1 --first-parent --name-only --format= "$sha" 2>/dev/null)"
    clean_body="$(printf '%s' "$body" | strip_trailers)"
    python3 - "$name" "$sha" "$author" "$date" "$subject" "$clean_body" "$files" >"$f" <<'PY'
import json, sys
name, sha, author, date, subject, body, files = sys.argv[1:8]
json.dump({
    "repo": name, "sha": sha, "author": author, "date": date,
    "subject": subject, "body": body,
    "files": [x for x in files.splitlines() if x.strip()][:50],
}, open(1, "w"))
PY
    new=$((new+1))
  done < <(git -C "$repo" log --first-parent "$branch" -n "$MAX_COMMITS" \
             --format="%H${US}%an${US}%aI${US}%s${US}%b${RS}")
  echo "[dump] $name: +$new new, $skip existing -> $out"
}

echo "== commit-index refresh =="
for r in "${REPOS[@]}"; do dump_repo "$r"; done

echo "== building index =="
"$PY" "$FLOW" index
