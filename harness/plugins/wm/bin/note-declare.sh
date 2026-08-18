#!/usr/bin/env bash
# Declare a note store for a folder, or for the branch checked out in a repo.
# Creates the store under $HOME/.notes, makes it a jj repo, and points the
# target's .notes symlink at it. Idempotent: run it twice, nothing changes.
#
#   note-declare.sh [<path>]            folder or repo notes (default: cwd)
#   note-declare.sh --branch [<path>]   notes for the branch checked out there
#   note-declare.sh --list              every store under the store root
#
# A path inside a git work tree declares repo notes at the work tree root; any
# other path declares folder notes, which is the case of one note over several
# repos sitting side by side.
#
# See code:ref-jj-notes.md for the store layout and the reconcile rule.
set -euo pipefail

lib="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/notes-store.sh"
# shellcheck source=notes-store.sh
source "$lib"

usage() {
  sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

branch_mode=false
target=""
while (($#)); do
  case "$1" in
    --branch)     branch_mode=true ;;
    --list)       list_mode=true ;;
    -h|--help)    usage 0 ;;
    -*)           echo "note-declare: unknown option $1" >&2; usage 1 ;;
    *)            target="$1" ;;
  esac
  shift
done

if [[ "${list_mode:-false}" == true ]]; then
  root=$(notes_store_root)
  [[ -d "$root" ]] || { echo "no stores yet under $root"; exit 0; }
  # Every jj repo under the store root is a store; print its name.
  find "$root" -maxdepth 4 -type d -name .jj -print 2>/dev/null |
    while read -r jj; do echo "${jj%/.jj}" | sed "s|^$root/||"; done | sort
  exit 0
fi

target="${target:-$PWD}"
[[ -d "$target" ]] || { echo "note-declare: no such folder: $target" >&2; exit 1; }
target=$(cd "$target" && pwd)

# A work tree declares at its root, so the notes sit beside the code, not beside
# whatever subdirectory the caller happened to stand in.
if repo_root=$(notes_repo_root "$target"); then
  tree=$(git -C "$target" rev-parse --show-toplevel)
  store="$(notes_store_root)/$(notes_store_name "$repo_root")"
  if [[ "$branch_mode" == true ]]; then
    branch=$(notes_branch "$target")
    [[ -n "$branch" ]] || { echo "note-declare: HEAD is detached — no branch to declare" >&2; exit 1; }
    store="$store@$branch"
  fi
  link_dir="$tree"
  notes_ignore "$tree"
else
  [[ "$branch_mode" == true ]] && { echo "note-declare: $target is not a git work tree" >&2; exit 1; }
  store="$(notes_store_root)/$(notes_store_name "$target")"
  link_dir="$target"
fi

notes_link "$link_dir" "$store"   # migrate an existing real .notes first
notes_store_init "$store"

echo "wm: $link_dir/.notes -> $store"
command -v jj >/dev/null 2>&1 || echo "wm: jj is absent — the store keeps no history until it is installed" >&2
