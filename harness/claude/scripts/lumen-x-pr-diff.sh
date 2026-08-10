#!/usr/bin/env bash
# Save a pull request's diff to a file and print its per-file change table.
#
# A large review is triaged from the file index first — path plus added/removed
# counts — and only then from the hunks, so the whole diff never has to be read
# to decide which files carry a decision. The diff is written to a file rather
# than stdout for the same reason: the caller reads the slices it needs.
#
# The PR number in the output path is the resolved number, so re-running for the
# same PR overwrites one file instead of accumulating copies.
set -euo pipefail

usage() {
	cat >&2 <<'EOF'
usage: lumen-x-pr-diff.sh [<pr-number>|<pr-url>|<branch>]

  lumen-x-pr-diff.sh                                   # the PR for the current branch
  lumen-x-pr-diff.sh 123
  lumen-x-pr-diff.sh https://github.com/owner/repo/pull/123

Prints the PR identity, a `<added> <removed> <path>` table sorted by total
change, the file count, and the path of the saved diff.
EOF
	exit 2
}

[[ ${1:-} == --help || ${1:-} == -h ]] && usage
[[ $# -le 1 ]] || usage

command -v gh >/dev/null || { printf 'gh not on PATH\n' >&2; exit 1; }
command -v jq >/dev/null || { printf 'jq not on PATH\n' >&2; exit 1; }

# An empty positional would reach gh as a literal "" argument and fail, so the
# no-argument case must pass no argument at all.
target=()
[[ -n ${1:-} ]] && target=("$1")

meta=$(gh pr view "${target[@]}" --json number,title,url,files) || {
	printf 'gh pr view failed — no PR for this branch, or the repo needs a different account\n' >&2
	exit 1
}

number=$(printf '%s' "$meta" | jq -er '.number')
out="${TMPDIR:-/tmp}/lumen-x-pr-${number}.diff"

gh pr diff "${target[@]}" >"$out"

printf 'pr: #%s %s\n' "$number" "$(printf '%s' "$meta" | jq -r '.url')"
printf 'title: %s\n' "$(printf '%s' "$meta" | jq -r '.title')"
printf 'files: %s\n' "$(printf '%s' "$meta" | jq -r '.files | length')"
printf 'diff: %s\n' "$out"
printf -- '--- added removed path ---\n'
printf '%s' "$meta" | jq -r '
	.files
	| sort_by(-(.additions + .deletions))
	| .[]
	| "\(.additions)\t\(.deletions)\t\(.path)"
'
