#!/usr/bin/env bash
# Opens a git diff in Zed as one multi-diff tab.
# `zed --diff` gives one tab only for a pair of directories; file pairs open a tab each.
# So both sides are mirror trees that hold the changed files alone. When the diff ends
# at the working tree, the right-hand tree is hard links to the live files, and an edit
# saved in Zed lands in the repo. Zed reads a symlink in the tree as a missing file.
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
usage: zed-diff.sh [-C DIR] [--print] [BASE [HEAD] | BASE..HEAD | COMMIT^!] [-- PATH...]
  (no revision)   HEAD against the working tree: the uncommitted change
  BASE            BASE against the working tree
  BASE HEAD       BASE against HEAD
  BASE..HEAD      the same as BASE HEAD
  COMMIT^!        one commit against its parent
  -C DIR          run in the repo at DIR
  --print         build the trees and print the zed command, open nothing
The right side is the live working tree when HEAD is omitted, or when HEAD is the
checked-out commit and the working tree has no change under the paths.
EOF
  exit 2
}

repo_dir=.
print_only=0
revisions=()
paths=()
while (($#)); do
  case $1 in
    -C) repo_dir=${2:?-C needs a directory}; shift 2 ;;
    --print) print_only=1; shift ;;
    -h | --help) usage ;;
    --) shift; paths=("$@"); break ;;
    *) revisions+=("$1"); shift ;;
  esac
done
((${#revisions[@]} <= 2)) || usage

cd "$repo_dir"
repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

base=${revisions[0]:-HEAD}
head=${revisions[1]:-}
if [[ $base == *'^!' ]]; then
  head=${base%'^!'}
  base="$head^"
elif [[ $base == *..* ]]; then
  head=${base#*..}
  base=${base%%..*}
fi
base_commit=$(git rev-parse --verify "$base^{commit}")

right_is_live=0
if [[ -z $head ]]; then
  right_is_live=1
else
  head_commit=$(git rev-parse --verify "$head^{commit}")
  if [[ $head_commit == "$(git rev-parse HEAD)" ]] && git diff --quiet HEAD -- ${paths[@]+"${paths[@]}"}; then
    right_is_live=1
  fi
fi

if ((right_is_live)); then
  changed=$(
    git diff --name-only "$base_commit" -- ${paths[@]+"${paths[@]}"}
    git ls-files --others --exclude-standard -- ${paths[@]+"${paths[@]}"}
  )
  right_label=working-tree
else
  changed=$(git diff --name-only "$base_commit" "$head_commit" -- ${paths[@]+"${paths[@]}"})
  right_label=$(git rev-parse --short "$head_commit")
fi
changed=$(printf '%s\n' "$changed" | sed '/^$/d' | sort -u)
if [[ -z $changed ]]; then
  echo "zed-diff: no change between the two sides" >&2
  exit 1
fi

work_dir=$(mktemp -d "${TMPDIR:-/tmp}/zed-diff.XXXXXX")
# line-comment-lsp reads this to store a comment on a tree file against the repo file.
printf '%s\n' "$repo_root" >"$work_dir/.line-comment-repo"
left_tree="$work_dir/$(git rev-parse --short "$base_commit")"
right_tree="$work_dir/$right_label"

file_count=0
copied=0
while IFS= read -r file; do
  mkdir -p "$(dirname "$left_tree/$file")" "$(dirname "$right_tree/$file")"
  git show "$base_commit:$file" >"$left_tree/$file" 2>/dev/null || : >"$left_tree/$file"
  if ((right_is_live)); then
    if [[ -e $repo_root/$file ]]; then
      ln -L "$repo_root/$file" "$right_tree/$file" 2>/dev/null || { cp "$repo_root/$file" "$right_tree/$file"; copied=$((copied + 1)); }
    else
      : >"$right_tree/$file"
    fi
  else
    git show "$head_commit:$file" >"$right_tree/$file" 2>/dev/null || : >"$right_tree/$file"
  fi
  file_count=$((file_count + 1))
done <<<"$changed"

mode=snapshot
((right_is_live)) && mode=live
echo "zed-diff: $file_count files, right side $mode, trees in $work_dir"
((copied)) && echo "zed-diff: $copied files copied, not linked: an edit to them does not reach the repo" >&2
if ((print_only)); then
  printf 'zed --existing --diff %q %q\n' "$left_tree" "$right_tree"
  exit 0
fi
zed --existing --diff "$left_tree" "$right_tree"
