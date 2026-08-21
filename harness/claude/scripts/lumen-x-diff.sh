#!/usr/bin/env bash
# Save the diff a `/lumen-x` triage reads and print its per-file change table.
#
# A large review is triaged from the file index first — path plus added/removed
# counts — and only then from the hunks, so the whole diff never has to be read
# to decide which files carry a decision. The diff is written to a file rather
# than stdout for the same reason: the caller reads the slices it needs.
#
# Four targets, one output shape: the uncommitted tree, a local range, the PR for
# the current branch, a PR by number or url. Review work is the same work whether
# a change has reached GitHub yet or not, so the triage must not care — only the
# reference handed to lumen differs, and that is saved to a sidecar file so the
# caller never has to restate it.
#
# The slug is the identity of a review: it names the saved diff, the selection
# list, and the reference, so re-running for the same target overwrites one set of
# files instead of accumulating copies.
#
# The index is counted from the saved diff, not from `gh --json files` or
# `git diff --numstat`, because it must name paths exactly as lumen-x-diff-slice.sh
# will match them. A count from one source and a path from another is how a file
# ends up looking like it changes nothing.
set -euo pipefail

usage() {
	cat >&2 <<'EOF'
usage: lumen-x-diff.sh [<target>]

  lumen-x-diff.sh                                    # uncommitted work: the tree against HEAD
  lumen-x-diff.sh main...HEAD                        # a local range
  lumen-x-diff.sh --pr                               # the PR for the current branch
  lumen-x-diff.sh 123
  lumen-x-diff.sh https://github.com/owner/repo/pull/123

Prints the target identity, its slug, the lumen reference, a
`<added> <removed> <path>` table sorted by total change, the file count, and the
path of the saved diff. Writes:

  $TMPDIR/lumen-x-<slug>.diff   the diff itself
  $TMPDIR/lumen-x-<slug>.ref    the reference lumen-x-open.sh hands to lumen

Exits 1 when the target holds no change at all — there is nothing to triage.
EOF
	exit 2
}

[[ ${1:-} == --help || ${1:-} == -h ]] && usage
[[ $# -le 1 ]] || usage

target=${1:-}
tmp=${TMPDIR:-/tmp}

err=$(mktemp)
trap 'rm -f "$err"' EXIT

# The b-side path and the counts come from the same pass over the same file, so the
# table can never name a path the slicer will not find.
index() {
	awk '
		function flush() {
			if (path != "") printf "%d\t%d\t%d\t%s\n", add + del, add, del, path
		}
		/^diff --git / {
			flush()
			# Always the b-side: git names both sides even for a delete, and the
			# slicer matches either, so this is the one name both agree on.
			path = $NF; sub(/^b\//, "", path)
			add = 0; del = 0
			next
		}
		/^\+\+\+ / || /^--- / { next }
		/^\+/ { add++; next }
		/^-/ { del++; next }
		END { flush() }
	' "$1" | sort -t"$(printf '\t')" -k1,1nr | cut -f2-
}

in_repo() {
	git rev-parse --show-toplevel >/dev/null 2>"$err" || {
		printf 'not a git repository: %s\n' "$PWD" >&2
		exit 1
	}
}

# Filename-safe and readable: every run of anything else collapses to one dash, so
# `main...HEAD` is `main-HEAD` and `HEAD~1..HEAD` is `HEAD-1-HEAD`.
slugify() {
	local s
	s=$(printf '%s' "$1" | tr -C 'A-Za-z0-9_-' '-' | tr -s '-')
	s=${s#-}
	s=${s%-}
	[[ -n $s ]] || { printf 'cannot name a review after %s\n' "$1" >&2; exit 1; }
	printf '%s' "$s"
}

reference=()

# Which of the four targets was named. Decided before the work so a branch called
# `2-fix-thing` cannot be read as PR 2 by a glob.
selected='range'
if [[ -z $target ]]; then
	selected='tree'
elif [[ $target == --pr || $target =~ ^[0-9]+$ || $target == http://* || $target == https://* ]]; then
	selected='pr'
fi

case $selected in
tree)
	in_repo
	kind='uncommitted (tree against HEAD)'
	slug=local
	out="${tmp}/lumen-x-${slug}.diff"
	git diff HEAD >"$out" 2>"$err" || { cat "$err" >&2; exit 1; }
	title="$(basename -- "$(git rev-parse --show-toplevel)") @ $(git branch --show-current) — uncommitted"
	# lumen with no reference shows the working tree, which is what /lumen opens.
	;;
pr)
	command -v gh >/dev/null || { printf 'gh not on PATH\n' >&2; exit 1; }
	command -v jq >/dev/null || { printf 'jq not on PATH\n' >&2; exit 1; }

	# An empty positional would reach gh as a literal "" argument and fail, so
	# --pr (the current branch's PR) must pass no argument at all.
	pr_target=()
	[[ $target == --pr ]] || pr_target=("$target")

	meta=$(gh pr view "${pr_target[@]+"${pr_target[@]}"}" --json number,title,url 2>"$err") || {
		printf 'gh pr view failed — no PR for this branch, or the repo needs a different account\n' >&2
		cat "$err" >&2
		exit 1
	}
	number=$(printf '%s' "$meta" | jq -er '.number')
	url=$(printf '%s' "$meta" | jq -r '.url')
	title=$(printf '%s' "$meta" | jq -r '.title')

	kind="pr #${number}"
	slug="pr-${number}"
	out="${tmp}/lumen-x-${slug}.diff"
	gh pr diff "${pr_target[@]+"${pr_target[@]}"}" >"$out"
	# --pr makes lumen shell out to gh, which needs an account that can resolve the
	# repo; a checked-out branch is better served by --ref on lumen-x-open.sh.
	reference=(--pr "$number")
	;;
range)
	in_repo
	git diff "$target" >/dev/null 2>"$err" || {
		printf 'not a diffable target: %s\n' "$target" >&2
		cat "$err" >&2
		printf 'accepted: nothing (the uncommitted tree), a range like main...HEAD, --pr, a PR number or url\n' >&2
		exit 1
	}
	kind="range ${target}"
	slug=$(slugify "$target")
	out="${tmp}/lumen-x-${slug}.diff"
	git diff "$target" >"$out"
	title="$(basename -- "$(git rev-parse --show-toplevel)") @ ${target}"
	reference=("$target")
	;;
esac

table=$(index "$out")
count=0
[[ -z $table ]] || count=$(printf '%s\n' "$table" | wc -l | tr -d ' ')

[[ $count -gt 0 ]] || {
	printf 'nothing to triage — %s holds no change\n' "$kind" >&2
	rm -f "$out"
	exit 1
}

ref_file="${tmp}/lumen-x-${slug}.ref"
# One token per line, and an empty file for the working tree, whose reference is
# every lumen argument absent.
: >"$ref_file"
[[ ${#reference[@]} -eq 0 ]] || printf '%s\n' "${reference[@]}" >"$ref_file"

printf 'target: %s\n' "$kind"
printf 'title: %s\n' "$title"
[[ -z ${url:-} ]] || printf 'url: %s\n' "$url"
printf 'slug: %s\n' "$slug"
printf 'ref: %s\n' "${reference[*]:-(working tree)}"
printf 'files: %s\n' "$count"
printf 'diff: %s\n' "$out"

# Untracked files are absent from any git diff, so a new file the author has not
# added would silently miss triage. Say so rather than let the count read as whole.
if [[ $slug == local ]]; then
	untracked=$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')
	[[ $untracked -eq 0 ]] || printf 'note: %s untracked file(s) are not in the diff — "git add -N" them to triage them\n' "$untracked"
fi

printf -- '--- added removed path ---\n'
printf '%s\n' "$table"
