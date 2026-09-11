#!/usr/bin/env bash
# Library — sourced, not run. The home-dir note store and the .notes symlink.
#
# The real notes live in $HOME/.notes/<store name>/, each one a standalone jj
# repo. A project folder holds only a symlink named .notes pointing at its
# store, so the notes survive a repo delete, a re-clone, or a worktree teardown.
#
# Store names come from the target path, so there is no registry file to keep in
# step:
#   ~/git/workspace-foo                   -> ~/.notes/git-workspace-foo
#   ~/Documents/git/dotfiles              -> ~/.notes/Documents-git-dotfiles
#     ... on branch feat/parser           -> ~/.notes/Documents-git-dotfiles@feat/parser
# The branch name is appended verbatim after @ and needs no escaping, because a
# nested path is a valid directory.
#
# A branch store exists only when the human declared it (note-declare.sh
# --branch). That existence IS the declaration — an undeclared branch keeps
# using the repo store and leaves nothing behind.

# Root of every store. Override with WM_NOTES_HOME (tests).
notes_store_root() {
  echo "${WM_NOTES_HOME:-$HOME/.notes}"
}

# Store name for a target path: the path under $HOME with / turned into -.
# A path outside $HOME keeps its full shape, minus the leading /.
notes_store_name() {
  local path="$1" rel
  case "$path" in
    "$HOME"/*) rel="${path#"$HOME"/}" ;;
    *)         rel="${path#/}" ;;
  esac
  echo "${rel//\//-}"
}

# The main repo root for a directory. A worktree resolves to the repo it was
# added from, so every worktree of one repo shares one store name.
# Prints nothing and fails when the directory has no work tree.
notes_repo_root() {
  local dir="$1" common
  [[ "$(git -C "$dir" rev-parse --is-inside-work-tree 2>/dev/null)" == "true" ]] || return 1
  common=$(git -C "$dir" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || return 1
  dirname "$common"
}

# The branch checked out in a directory. Empty on a detached HEAD.
notes_branch() {
  git -C "$1" symbolic-ref --short HEAD 2>/dev/null || true
}

# The nearest notes dir at or above a directory — the one every hook and script
# reads. Prints its path; fails when no `.notes/.jj` is found on the way up.
# Follows the symlink case for free: `.notes/.jj` resolves through the link.
notes_find_dir() {
  local dir="$1" parent
  [[ -n "$dir" && -d "$dir" ]] || return 1
  while :; do
    [[ -d "$dir/.notes/.jj" ]] && { echo "$dir/.notes"; return 0; }
    parent=$(dirname "$dir")
    [[ "$parent" == "$dir" ]] && return 1
    dir="$parent"
  done
}

# A store is real when it holds a jj repo. `<store>@feat` is only a parent of
# `<store>@feat/parser`, so the directory alone proves nothing.
notes_store_exists() {
  [[ -d "$1/.jj" ]]
}

# Create the store and its jj repo. Silent when the jj repo is already there.
notes_store_init() {
  local store="$1"
  mkdir -p "$store"
  notes_store_exists "$store" && return 0
  command -v jj >/dev/null 2>&1 || return 0
  jj git init "$store" >/dev/null 2>&1 || return 0
}

# Ignore the .notes symlink in the enclosing git repo, through a local
# (uncommitted) gitignore — the `local-gitignore` skill's file and wiring.
#
# The name carries NO trailing slash: git treats a symlink as a file, and a
# trailing slash matches directories only, so `.notes/` leaves the symlink
# untracked and visible in git status.
notes_ignore() {
  local dir="$1" root ignore current global
  root=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || return 0
  [[ -z "$root" ]] && return 0
  ignore="$root/.local.gitignore"
  # Carry an older `.gitignore.local` over to the one name the skill uses.
  [[ -f "$root/.gitignore.local" && ! -f "$ignore" ]] && mv "$root/.gitignore.local" "$ignore"

  grep -qxF '.notes' "$ignore" 2>/dev/null || echo '.notes' >>"$ignore"
  # The ignore file is local and uncommitted, so it ignores itself — otherwise it
  # is the one thing left dirty in git status.
  grep -qxF '.local.gitignore' "$ignore" 2>/dev/null || echo '.local.gitignore' >>"$ignore"

  # Wire excludesFile only if unset locally — don't clobber an existing one.
  # ponytail: if they already point core.excludesFile elsewhere, the .notes line
  # above won't apply; rare, and they can add it to their own file.
  current=$(git -C "$root" config --local core.excludesFile 2>/dev/null || true)
  [[ -n "$current" ]] && return 0

  # core.excludesFile holds ONE path: a repo-local value REPLACES the global one
  # instead of adding to it. Copy the global patterns in first, or everything the
  # global file covered starts showing up in git status here.
  global=$(git config --global core.excludesFile 2>/dev/null || true)
  global="${global/#\~/$HOME}"
  if [[ -n "$global" && -f "$global" ]] &&
     ! grep -qxF '# --- carried over from the global core.excludesFile ---' "$ignore" 2>/dev/null; then
    {
      echo '# --- carried over from the global core.excludesFile ---'
      echo '# A repo-local core.excludesFile REPLACES the global one, so these'
      echo '# would stop being ignored here without the copies.'
      cat "$global"
    } >>"$ignore"
  fi
  git -C "$root" config --local core.excludesFile "$ignore" 2>/dev/null || true
  return 0
}

# Point <dir>/.notes at a store. An existing real directory moves into the store
# first, so a project that already keeps notes in place is not lost. Call this
# BEFORE notes_store_init: a real .notes that is already a jj repo carries its
# .jj along, and its history survives.
notes_link() {
  local dir="$1" store="$2" link
  # One name per `local`: bash expands every word of a `local` line before it
  # assigns any of them, so `local dir="$1" link="$dir/..."` reads an unset dir.
  link="$dir/.notes"
  mkdir -p "$store"
  if [[ -d "$link" && ! -L "$link" ]]; then
    # Dotfiles too, but never . or .. — and never the jj repo of the store.
    ( shopt -s dotglob nullglob; for f in "$link"/*; do mv -n "$f" "$store/"; done )
    rmdir "$link" 2>/dev/null || {
      echo "wm: $link is not empty after the move — left in place" >&2
      return 1
    }
  fi
  ln -sfn "$store" "$link"
}

# Point an already-declared .notes symlink at the store the current branch wants.
# Runs on every prompt, so switching branch mid-session lands on the right notes.
# Leaves everything alone unless .notes is a symlink into the store root — a real
# directory is the human's, not ours.
notes_reconcile() {
  local dir="$1" root tree link current branch repo_store want
  root=$(notes_repo_root "$dir") || return 0
  # The link sits where the human works (the worktree root); the store name comes
  # from the main repo, so every worktree of one repo shares one set of stores.
  tree=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || return 0
  link="$tree/.notes"
  [[ -L "$link" ]] || return 0
  current=$(readlink "$link")
  case "$current" in "$(notes_store_root)"/*) ;; *) return 0 ;; esac

  repo_store="$(notes_store_root)/$(notes_store_name "$root")"
  branch=$(notes_branch "$dir")
  want=""
  [[ -n "$branch" ]] && notes_store_exists "$repo_store@$branch" && want="$repo_store@$branch"
  [[ -z "$want" ]] && notes_store_exists "$repo_store" && want="$repo_store"
  [[ -z "$want" || "$current" == "$want" ]] && return 0
  ln -sfn "$want" "$link"
}
