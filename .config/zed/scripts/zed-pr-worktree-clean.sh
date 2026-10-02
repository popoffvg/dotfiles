#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
zed-pr-worktree-clean.sh [--repo DIR] [--yes] [--dry-run]

Remove every PR review worktree <repo>.pr-<N> that zed-pr-worktree.sh made.
A worktree with uncommitted changes stays. The local branch is deleted only
when the PR head on origin contains its tip, so local commits are never lost.
EOF
}

repo_dir="${ZED_WORKTREE_ROOT:-$PWD}"
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
    -y | --yes)
      assume_yes=1
      shift
      ;;
    -n | --dry-run)
      dry_run=1
      shift
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

common_dir="$(git -C "$repo_dir" rev-parse --path-format=absolute --git-common-dir)"
main_root="$(dirname "$common_dir")"
cd "$main_root"

paths=()
branches=()
while IFS=$'\t' read -r path branch; do
  paths+=("$path")
  branches+=("$branch")
done < <(
  git worktree list --porcelain |
    awk -v prefix="$main_root.pr-" '
      /^worktree /{path=substr($0,10); branch=""}
      /^branch /{branch=substr($0,19)}
      /^$/{if (index(path, prefix)==1 && substr(path, length(prefix)+1) ~ /^[0-9]+$/) print path "\t" branch; path=""}
      END{if (path!="" && index(path, prefix)==1 && substr(path, length(prefix)+1) ~ /^[0-9]+$/) print path "\t" branch}
    '
)

if [ "${#paths[@]}" -eq 0 ]; then
  echo "no PR review worktrees under $main_root.pr-*"
  [ "$dry_run" -eq 1 ] || git worktree prune
  exit 0
fi

echo "PR review worktrees of $main_root:"
for i in "${!paths[@]}"; do
  echo "  ${paths[$i]}  (${branches[$i]:-detached})"
done

if [ "$dry_run" -eq 1 ]; then
  exit 0
fi

if [ "$assume_yes" -eq 0 ]; then
  read -r -p "remove them? [y/N] " answer
  case "$answer" in
    y | Y | yes) ;;
    *) exit 0 ;;
  esac
fi

removed=0
kept=0
for i in "${!paths[@]}"; do
  path="${paths[$i]}"
  branch="${branches[$i]}"
  pr="${path##*.pr-}"

  if [ -d "$path" ]; then
    dirty="$(git -C "$path" status --porcelain --untracked-files=all | grep -v ' \.zed/settings\.json$' || true)"
    if [ -n "$dirty" ]; then
      echo "keep $path: uncommitted changes"
      kept=$((kept + 1))
      continue
    fi
  fi

  git worktree remove --force "$path"
  echo "removed $path"
  removed=$((removed + 1))

  [ -n "$branch" ] || continue
  if git fetch --quiet origin "pull/$pr/head" 2>/dev/null &&
    git merge-base --is-ancestor "$branch" FETCH_HEAD; then
    git branch -D "$branch" >/dev/null
    echo "deleted branch $branch"
  else
    echo "keep branch $branch: the PR head on origin does not contain its tip"
  fi
done

git worktree prune
echo "removed $removed, kept $kept"
