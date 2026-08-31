#!/usr/bin/env bash
# Make a gist's file set match exactly the local files given.
#
# Updates changed files, adds new ones, and DELETES any file in the gist that is
# not among the arguments. `gh gist edit` can only add or replace one file, so
# this drives the REST API, where a null value deletes a file.
#
# Usage:
#   gist-sync-files.sh <gist-id> [--desc "text"] <file>...
#
# Env:
#   DRY_RUN=1   print the JSON payload and the delete list, change nothing
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: $0 <gist-id> [--desc \"text\"] <file>..." >&2
  exit 2
fi

gist_id="$1"
shift

desc=""
if [ "${1:-}" = "--desc" ]; then
  desc="$2"
  shift 2
fi

if [ "$#" -eq 0 ]; then
  echo "$0: no files given; refusing to empty gist $gist_id" >&2
  exit 2
fi

for f in "$@"; do
  if [ ! -f "$f" ]; then
    echo "$0: not a file: $f" >&2
    exit 2
  fi
done

# Remote file names, so we can null out the ones no longer present locally.
remote=$(gh api "gists/$gist_id" --jq '.files | keys[]')

keep=""
for f in "$@"; do
  keep="$keep$(basename "$f")"$'\n'
done

payload=$(
  KEEP="$keep" DESC="$desc" REMOTE="$remote" python3 - "$@" <<'PY'
import json, os, sys

keep = {l for l in os.environ["KEEP"].splitlines() if l}
remote = {l for l in os.environ["REMOTE"].splitlines() if l}

files = {}
for path in sys.argv[1:]:
    name = os.path.basename(path)
    with open(path, encoding="utf-8") as fh:
        files[name] = {"content": fh.read()}

# A null value tells the API to delete that file.
for name in remote - keep:
    files[name] = None

body = {"files": files}
desc = os.environ.get("DESC", "")
if desc:
    body["description"] = desc

json.dump(body, sys.stdout)
PY
)

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "$payload" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("keep/update:", [k for k,v in d["files"].items() if v]); print("delete:", [k for k,v in d["files"].items() if v is None])'
  exit 0
fi

printf '%s' "$payload" | gh api -X PATCH "gists/$gist_id" --input - --jq '.html_url'
