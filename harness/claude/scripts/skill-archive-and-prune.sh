#!/usr/bin/env bash
# Make a loose skill's deletion reversible, then delete it.
#
# A prune is only safe if the skill can come back, and "it is in the dotfiles
# directory" does not mean git has it: a skill can sit in the repo tree,
# symlinked into ~/.claude/skills, and still be untracked — deleting it then
# loses it exactly as if it had never been in the repo. So this always commits
# the skill before removing it.
#
# Per skill, whichever state it is in:
#   real dir outside the repo   -> moved into the repo, then committed
#   symlink into the repo       -> committed in place
#   already tracked             -> committed nothing, straight to the removal
# then a second commit removes it and the ~/.claude/skills symlink goes too, so
# no dangling link is left where a skill used to be.
#
# Two commits on purpose: one that only adds, one that only removes. A single
# commit doing both would record no state containing the file, leaving nothing
# to restore from.
#
# Usage:
#   skill-archive-and-prune.sh --names-file FILE [options]
#   skill-archive-and-prune.sh NAME... [options]
# Options:
#   --repo DIR        dotfiles repo (default ~/git/dotfiles)
#   --dest SUBDIR     skills path inside the repo (default harness/claude/skills)
#   --skills-dir DIR  live skills dir (default ~/.claude/skills)
#   --keep            archive and commit only; leave the skill active
#   --dry-run         print the plan, change nothing
set -euo pipefail

repo="${HOME}/git/dotfiles"
dest_rel="harness/claude/skills"
skills_dir="${HOME}/.claude/skills"
dry_run=false
keep=false
names=()

while [ $# -gt 0 ]; do
  case "$1" in
    --names-file) mapfile -t names < <(grep -v '^[[:space:]]*$' "$2"); shift 2 ;;
    --repo)       repo=$2; shift 2 ;;
    --dest)       dest_rel=$2; shift 2 ;;
    --skills-dir) skills_dir=$2; shift 2 ;;
    --keep)       keep=true; shift ;;
    --dry-run)    dry_run=true; shift ;;
    -*)           printf 'unknown flag: %s\n' "$1" >&2; exit 2 ;;
    *)            names+=("$1"); shift ;;
  esac
done

[ ${#names[@]} -gt 0 ] || { printf 'no skill names given\n' >&2; exit 2; }
dest="$repo/$dest_rel"
mkdir -p "$dest"

# Classify every name before touching anything, so a mixed batch cannot be
# half-applied and the plan can be printed as one list.
plan_names=()
plan_states=()
for name in "${names[@]}"; do
  live="$skills_dir/$name"
  in_repo="$dest/$name"
  state=""
  if [ -e "$in_repo" ]; then
    if git -C "$repo" ls-files --error-unmatch "$dest_rel/$name" >/dev/null 2>&1; then
      state="tracked"
    else
      state="in-repo-untracked"
    fi
  elif [ -L "$live" ]; then
    state="broken-symlink"
  elif [ -d "$live" ]; then
    state="outside-repo"
  else
    state="missing"
  fi
  plan_names+=("$name")
  plan_states+=("$state")
  printf '%-22s %s\n' "$state" "$name"
done
$dry_run && { printf '\ndry run — nothing changed\n'; exit 0; }

# Phase 1: get every skill into the repo and into a commit.
staged=()
for i in "${!plan_names[@]}"; do
  name=${plan_names[$i]}
  case "${plan_states[$i]}" in
    outside-repo)      mv "$skills_dir/$name" "$dest/$name"; staged+=("$dest_rel/$name") ;;
    in-repo-untracked) staged+=("$dest_rel/$name") ;;
    tracked)           ;;
    *)                 printf 'skip: %s (%s)\n' "$name" "${plan_states[$i]}" ;;
  esac
done

archive_sha=""
if [ ${#staged[@]} -gt 0 ]; then
  git -C "$repo" add -- "${staged[@]}"
  git -C "$repo" commit --only -q -m "harness: archive ${#staged[@]} unused skills into git

These sat in the repo tree but were never committed, so deleting them would
have been permanent. This commit is the copy the next one removes.

$(printf '%s\n' "${staged[@]}")" -- "${staged[@]}"
  archive_sha=$(git -C "$repo" rev-parse --short HEAD)
  printf 'archive commit: %s (%d skills)\n' "$archive_sha" "${#staged[@]}"
else
  archive_sha=$(git -C "$repo" rev-parse --short HEAD)
  printf 'nothing to archive; everything already tracked at %s\n' "$archive_sha"
fi

if $keep; then
  printf 'kept active (--keep)\n'
  exit 0
fi

# Phase 2: remove the tracked copy and the link that pointed at it.
removed=()
for i in "${!plan_names[@]}"; do
  name=${plan_names[$i]}
  case "${plan_states[$i]}" in
    outside-repo|in-repo-untracked|tracked) removed+=("$dest_rel/$name") ;;
  esac
done
[ ${#removed[@]} -gt 0 ] || { printf 'nothing to remove\n'; exit 0; }

git -C "$repo" rm -r -q -- "${removed[@]}"
git -C "$repo" commit --only -q -m "harness: drop the archived unused skills

The skill listing is loaded into every session, so an unused skill costs
context in all of them. Restore any of these with
  git show $archive_sha:$dest_rel/<name>/SKILL.md

$(printf '%s\n' "${removed[@]}")" -- "${removed[@]}"
printf 'prune commit:   %s (%d skills)\n' "$(git -C "$repo" rev-parse --short HEAD)" "${#removed[@]}"

# The live symlink now points at a path git no longer has. Claude Code would
# read the dangling entry as a broken skill, so it goes with its target.
dangling=0
for name in "${plan_names[@]}"; do
  live="$skills_dir/$name"
  if [ -L "$live" ] && [ ! -e "$live" ]; then
    rm "$live"
    dangling=$((dangling + 1))
  fi
done
printf 'removed %d dangling symlink(s) from %s\n' "$dangling" "$skills_dir"
printf 'restore with:    git show %s:%s/<name>/SKILL.md\n' "$archive_sha" "$dest_rel"
