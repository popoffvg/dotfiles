#!/usr/bin/env bash
# Open a GitHub PR for review in its own worktree, under hunk + the
# hunk-gh-review extension (T = threads, c = note, S = submit one atomic review).
#
#   pr-review.sh              # PR of the current branch
#   pr-review.sh 123          # PR #123
#   pr-review.sh https://github.com/owner/repo/pull/123
#   pr-review.sh -C ~/git 123 # look for the repo under ~/git instead of $PWD
#
# The worktree comes from `wt switch pr:N`; this script only resolves the repo,
# the PR number, and the base ref, then hands the terminal to hunk.
set -euo pipefail

die() { printf 'pr-review: %s\n' "$*" >&2; exit 1; }

start_dir=$PWD
pr_arg=""
dry_run=0

while [ $# -gt 0 ]; do
  case $1 in
    -C) start_dir=${2:?-C needs a directory}; shift 2 ;;
    -n|--dry-run) dry_run=1; shift ;;
    -h|--help) sed -n '2,8p' "$0" | sed 's/^#[[:space:]]\{0,1\}//'; exit 0 ;;
    -*) die "unknown option: $1" ;;
    *) pr_arg=$1; shift ;;
  esac
done

command -v wt >/dev/null || die "worktrunk (wt) is not installed"
command -v gh >/dev/null || die "gh is not installed"
command -v hunk >/dev/null || die "hunk is not installed"
hunk extension list 2>/dev/null | grep -q hunk-gh-review \
  || die "the hunk-gh-review extension is missing — run: hunk extension install phl28/hunk-gh-review"

# --- find the repo ---------------------------------------------------------
# The starting directory itself, or — when it is not a repo — the single git
# repo directly inside it. Two candidates is an ambiguity the caller resolves.
if repo=$(git -C "$start_dir" rev-parse --show-toplevel 2>/dev/null); then
  :
else
  candidates=()
  for d in "$start_dir"/*/; do
    [ -d "$d" ] || continue
    git -C "$d" rev-parse --show-toplevel >/dev/null 2>&1 && candidates+=("${d%/}")
  done
  case ${#candidates[@]} in
    1) repo=$(git -C "${candidates[0]}" rev-parse --show-toplevel) ;;
    0) die "no git repo in $start_dir" ;;
    *) die "several git repos in $start_dir — pass -C <repo>: ${candidates[*]}" ;;
  esac
fi

# --- resolve the PR --------------------------------------------------------
# gh picks its base repo from the remotes (upstream > github > origin), so a
# fork clone can silently answer for the wrong repo. Pin the slug once here and
# pass it to every later gh call and to the extension.
slug=$(cd "$repo" && gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null) \
  || die "cannot resolve the repo slug — try: gh repo set-default owner/repo"

case $pr_arg in
  "")        pr=$(cd "$repo" && gh pr view --json number -q .number 2>/dev/null) \
               || die "the current branch has no open PR — pass a PR number" ;;
  */pull/*)  pr=${pr_arg##*/pull/}; pr=${pr%%[!0-9]*} ;;
  *[!0-9]*)  die "not a PR number or URL: $pr_arg" ;;
  *)         pr=$pr_arg ;;
esac
[ -n "$pr" ] || die "no PR number in: $pr_arg"

base=$(gh pr view "$pr" -R "$slug" --json baseRefName -q .baseRefName) \
  || die "PR #$pr not found in $slug"

launch="GH_PR_NUMBER=$pr GH_PR_REPO=$slug hunk diff origin/$base...HEAD"

if [ "$dry_run" = 1 ]; then
  printf 'repo:   %s\nslug:   %s\npr:     %s\nbase:   %s\nlaunch: wt -C %s switch pr:%s -x %s\n' \
    "$repo" "$slug" "$pr" "$base" "$repo" "$pr" "$launch"
  exit 0
fi

git -C "$repo" fetch --quiet origin "$base" 2>/dev/null || true

printf 'pr-review: %s#%s onto %s\n' "$slug" "$pr" "$base" >&2

# `wt switch` creates the worktree if needed, runs its hooks, then -x replaces
# the process so hunk owns the terminal.
exec wt -C "$repo" switch "pr:$pr" -x "$launch"
