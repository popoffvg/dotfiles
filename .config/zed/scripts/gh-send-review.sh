#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
gh-send-review.sh [--repo DIR] [--pr N] [--yes] [--dry-run]

Render the line comments the store holds as a review report, show it, ask whether to
send it, then submit one GitHub review on the PR of the current branch: each note
becomes an inline comment on its line, and a note on a line outside the diff goes into
the review body. The batch is filed under .tmp/review-session/<timestamp>/.
EOF
}

repo_dir="${ZED_WORKTREE_ROOT:-$PWD}"
pr=""
assume_yes=0
dry_run=0

while [ $# -gt 0 ]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --repo)
      repo_dir="$2"
      shift 2
      ;;
    --pr)
      pr="$2"
      shift 2
      ;;
    --yes)
      assume_yes=1
      shift
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

for bin in gh git line-comment-lsp python3; do
  command -v "$bin" >/dev/null 2>&1 || {
    echo "missing required command: $bin" >&2
    exit 1
  }
done

cd "$repo_dir"
repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

store="$(line-comment-lsp store)"
[ -f "$store" ] || {
  echo "no line comments to send (no store at $store)"
  exit 0
}

if [ -z "$pr" ]; then
  pr="$(gh pr view --json number --jq .number 2>/dev/null || true)"
fi
[ -n "$pr" ] || {
  echo "no pull request for the current branch — pass --pr N" >&2
  exit 1
}

nwo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

report="$(mktemp -t gh-send-review)"
payload="$(mktemp -t gh-send-review-payload)"
trap 'rm -f "$report" "$payload"' EXIT

diff_files="$(mktemp -t gh-send-review-files)"
gh api --paginate "repos/$nwo/pulls/$pr/files" --jq '.[] | {filename, patch}' >"$diff_files"

count="$(
  python3 - "$store" "$report" "$payload" "$diff_files" <<'PY'
import json, sys

store, report_path, payload_path, diff_path = sys.argv[1:5]
data = json.load(open(store))
files = data.get("files", {})


def commentable_lines(patch):
    """Line numbers on the new side of the file that sit inside a diff hunk."""
    lines = set()
    new_line = 0
    for row in (patch or "").splitlines():
        if row.startswith("@@"):
            new_line = int(row.split("+")[1].split(",")[0].split()[0])
        elif row.startswith("+") or row.startswith(" ") or row == "":
            lines.add(new_line)
            new_line += 1
        elif row.startswith("-"):
            continue
    return lines


in_diff = {}
for row in open(diff_path):
    row = row.strip()
    if not row:
        continue
    entry = json.loads(row)
    in_diff[entry["filename"]] = commentable_lines(entry.get("patch"))

comments, off_diff, report = [], [], ["## Review notes", ""]
count = 0

for path in sorted(files):
    notes = sorted(files[path], key=lambda c: c.get("line", 0))
    if not notes:
        continue
    report.append(f"**`{path}`**")
    report.append("")
    for note in notes:
        start = note.get("line")
        end = note.get("end_line") or start
        text = (note.get("text") or "").strip()
        marks = []
        if note.get("author") and note["author"] != "human":
            marks.append(f"from {note['author']}")
        if note.get("orphaned"):
            marks.append("orphaned")
        suffix = f" _({', '.join(marks)})_" if marks else ""
        where = f"L{start}" if end == start else f"L{start}-L{end}"
        count += 1

        hunk = in_diff.get(path, set())
        if end in hunk:
            comment = {"path": path, "line": end, "side": "RIGHT", "body": text}
            if end != start and start in hunk:
                comment["start_line"] = start
                comment["start_side"] = "RIGHT"
            comments.append(comment)
            report.append(f"- `{where}` — {text}{suffix}")
        else:
            off_diff.append(f"- `{path}:{where}` — {text}{suffix}")
            report.append(f"- `{where}` — {text}{suffix} _(outside the diff → review body)_")
    report.append("")

body = ""
if off_diff:
    body = "Notes on lines outside this diff:\n\n" + "\n".join(off_diff)

json.dump({"event": "COMMENT", "body": body, "comments": comments}, open(payload_path, "w"))
open(report_path, "w").write("\n".join(report).rstrip() + "\n")
print(count)
PY
)"
rm -f "$diff_files"

[ "$count" -gt 0 ] || {
  echo "no line comments to send"
  exit 0
}

echo "PR #$pr — $count line comment(s):"
echo
cat "$report"
echo

if [ "$dry_run" -eq 1 ]; then
  echo "(dry run — nothing sent) payload:"
  cat "$payload"
  echo
  exit 0
fi

if [ "$assume_yes" -eq 0 ]; then
  read -r -p "Send this to PR #$pr? [y/N] " answer
  case "$answer" in
    y | Y | yes | YES) ;;
    *)
      echo "not sent — the comments stay in the store"
      exit 0
      ;;
  esac
fi

comment_url="$(gh api "repos/$nwo/pulls/$pr/reviews" --input "$payload" --jq .html_url)"
echo "posted: $comment_url"

session="$repo_root/.tmp/review-session/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$session"
mv "$store" "$session/line-comment.json"
{
  echo "# review session $(basename "$session") — sent to PR #$pr"
  echo
  echo "$comment_url"
  echo
  cat "$report"
} >"$session/processed.md"

echo "filed: $session"
