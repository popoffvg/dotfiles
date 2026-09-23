#!/usr/bin/env bash
# Print one TSV row per git worktree: path, repo, branch, dirty/untracked counts,
# commits not in the remote default branch (patch-id aware), and the PR state of the branch.
# Args: <worktree-dir>...   Env: NO_FETCH=1 skips the fetch of each distinct repo.
set -uo pipefail

declare -A fetched
gitc() { git -c url.https://github.com/.insteadOf=git@github.com: -c 'credential.https://github.com.helper=!gh auth git-credential' "$@"; }

printf 'path\trepo\tbranch\tdirty\tuntracked\tunique\tpr\n'
for wt in "$@"; do
  [ -d "$wt" ] || { printf '%s\t-\t-\t-\t-\t-\tMISSING\n' "$wt"; continue; }
  common=$(git -C "$wt" rev-parse --git-common-dir 2>/dev/null) || { printf '%s\t-\t-\t-\t-\t-\tNOT-GIT\n' "$wt"; continue; }
  common=$(cd "$wt" && cd "$common" && pwd)
  url=$(git -C "$wt" remote get-url origin 2>/dev/null || echo '')
  slug=$(sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##' <<<"$url")
  if [ -z "${NO_FETCH:-}" ] && [ -z "${fetched[$common]:-}" ]; then
    gitc -C "$wt" fetch -q origin --prune >/dev/null 2>&1
    fetched[$common]=1
  fi
  base=$(git -C "$wt" symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)
  branch=$(git -C "$wt" symbolic-ref -q --short HEAD || echo DETACHED)
  dirty=$(git -C "$wt" status --porcelain --untracked-files=no | wc -l | tr -d ' ')
  untracked=$(git -C "$wt" status --porcelain | grep -c '^??')
  unique=$(git -C "$wt" cherry "$base" HEAD 2>/dev/null | grep -c '^+')
  pr='-'
  if [ "$branch" != DETACHED ] && [ "origin/$branch" != "$base" ] && [ -n "$slug" ]; then
    pr=$(gh pr list -R "$slug" --head "$branch" --state all --limit 1 --json number,state --jq 'if length == 0 then "none" else .[0] | "#\(.number) \(.state)" end' 2>/dev/null)
    [ -z "$pr" ] && pr='none'
  fi
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$wt" "$slug" "$branch" "$dirty" "$untracked" "$unique" "$pr"
done
