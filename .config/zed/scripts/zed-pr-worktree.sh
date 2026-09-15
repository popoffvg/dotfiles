#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
zed-pr-worktree.sh [PR] [--repo DIR] [--no-open]

Pick a GitHub PR of the current repo (fzf picker when PR is omitted), reuse or
create its worktree at <repo>.pr-<N>, point Zed's diff base at the branch base,
and open the worktree in Zed.
EOF
}

pr=""
repo_dir="${ZED_WORKTREE_ROOT:-$PWD}"
open_zed=1

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
    --no-open)
      open_zed=0
      shift
      ;;
    *)
      pr="$1"
      shift
      ;;
  esac
done

for bin in gh git; do
  command -v "$bin" >/dev/null 2>&1 || {
    echo "missing required command: $bin" >&2
    exit 1
  }
done

cd "$repo_dir"
repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if [ -z "$pr" ]; then
  command -v fzf >/dev/null 2>&1 || {
    echo "fzf is required to pick a PR interactively" >&2
    exit 1
  }
  line="$(
    gh pr list --limit 50 \
      --json number,title,author,headRefName,baseRefName,isDraft \
      --jq '.[] | "#\(.number)\t\(.title)\t\(.headRefName) → \(.baseRefName)\t@\(.author.login)\(if .isDraft then "  [draft]" else "" end)"' |
      fzf --ansi --no-sort --prompt='PR > ' --header='select a pull request' \
        --delimiter='\t' --with-nth=1,2,3,4 \
        --preview='GH_FORCE_TTY=1 GH_PAGER=cat gh pr view {1}' --preview-window=right,60%,wrap
  )" || exit 0
  [ -n "$line" ] || exit 0
  pr="${line%%$'\t'*}"
fi

pr="${pr#\#}"

read -r head_ref base_ref <<<"$(gh pr view "$pr" --json headRefName,baseRefName --template '{{.headRefName}} {{.baseRefName}}')"
[ -n "$head_ref" ] || {
  echo "could not resolve PR #$pr" >&2
  exit 1
}

echo "PR #$pr: $head_ref → $base_ref"

worktree_for_branch() {
  git worktree list --porcelain |
    awk -v ref="refs/heads/$1" '
      /^worktree /{path=substr($0,10)}
      $0=="branch "ref{print path; exit}
    '
}

worktree_path="$(worktree_for_branch "$head_ref")"
if [ -n "$worktree_path" ] && [ -d "$worktree_path" ]; then
  echo "reusing worktree: $worktree_path"
else
  worktree_path="$repo_root.pr-$pr"
  if [ -d "$worktree_path" ]; then
    echo "reusing worktree: $worktree_path"
  else
    if git show-ref --verify --quiet "refs/heads/$head_ref"; then
      echo "branch $head_ref already exists locally — not updating it from the PR"
      git fetch --quiet origin "pull/$pr/head" || true
    else
      git fetch origin "pull/$pr/head:$head_ref"
    fi
    git worktree add "$worktree_path" "$head_ref"
    if command -v mise >/dev/null 2>&1 &&
      { [ -f "$worktree_path/mise.toml" ] || [ -f "$worktree_path/.mise.toml" ] ||
        [ -f "$worktree_path/.config/mise/config.toml" ]; }; then
      (cd "$worktree_path" && mise trust >/dev/null 2>&1) || true
    fi
  fi
fi

[ -n "$worktree_path" ] && [ -d "$worktree_path" ] || {
  echo "worktree for PR #$pr not found; run: wt list" >&2
  exit 1
}

# Bring the base branch up to date, so the diff base is the tip of the PR target.
# git refuses to fetch into a branch another worktree has checked out, so that case
# updates the remote ref alone.
if [ -n "$(worktree_for_branch "$base_ref")" ]; then
  git -C "$worktree_path" fetch --quiet origin "$base_ref"
else
  git -C "$worktree_path" fetch --quiet origin "$base_ref:$base_ref"
fi
echo "base branch $base_ref fetched"

default_branch="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
default_branch="${default_branch#origin/}"

settings="$worktree_path/.zed/settings.json"
if [ ! -e "$settings" ]; then
  mkdir -p "$worktree_path/.zed"
  cat >"$settings" <<'EOF'
{
  "git": {
    "diff_base": "default_branch"
  }
}
EOF
elif ! grep -q '"diff_base"' "$settings"; then
  python3 - "$settings" <<'PY'
import re, sys

path = sys.argv[1]
text = open(path).read()
block = '  "git": { "diff_base": "default_branch" },\n'

git_key = re.search(r'^(\s*)"git"\s*:\s*\{', text, re.M)
if git_key:
    insert_at = git_key.end()
    text = text[:insert_at] + '\n' + git_key.group(1) + '  "diff_base": "default_branch",' + text[insert_at:]
else:
    brace = text.index('{')
    text = text[: brace + 1] + '\n' + block.rstrip('\n') + text[brace + 1 :]
open(path, 'w').write(text)
PY
  git -C "$worktree_path" ls-files --error-unmatch .zed/settings.json >/dev/null 2>&1 &&
    git -C "$worktree_path" update-index --skip-worktree .zed/settings.json
fi

if [ -n "$default_branch" ] && [ "$default_branch" != "$base_ref" ]; then
  echo "warning: PR targets $base_ref but the repo default branch is $default_branch — Zed's diff base will use $default_branch"
fi

echo "worktree: $worktree_path"
if [ "$open_zed" -eq 1 ]; then
  zed --existing "$worktree_path"
fi
