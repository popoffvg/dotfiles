#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILLS_DIR="$ROOT/harness/skills"
REPO="$HOME/.cache/amp/repositories/ampcode.com-user-skills"

if [[ $# -eq 0 ]]; then
  echo "Usage: mise run harness:amp:publish-skills <skill> [skill ...]" >&2
  exit 1
fi

for name in "$@"; do
  if [[ ! "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || [[ ! -f "$SKILLS_DIR/$name/SKILL.md" ]]; then
    echo "publish-amp-skills: unknown skill: $name" >&2
    exit 1
  fi
done

if [[ ! -d "$REPO" ]]; then
  mkdir -p "$(dirname "$REPO")"
  amp clone user-skills "$REPO"
fi

if [[ -n "$(git -C "$REPO" status --porcelain)" ]]; then
  echo "publish-amp-skills: repository has uncommitted changes: $REPO" >&2
  exit 1
fi
if [[ "$(git -C "$REPO" symbolic-ref --short HEAD)" != main ]]; then
  echo "publish-amp-skills: repository must be on main: $REPO" >&2
  exit 1
fi

git -C "$REPO" fetch origin main
if [[ "$(git -C "$REPO" rev-list --count origin/main..HEAD)" != 0 ]]; then
  echo "publish-amp-skills: resolve unpublished commits before publishing: $REPO" >&2
  exit 1
fi
git -C "$REPO" merge --ff-only origin/main

for name in "$@"; do
  mkdir -p "$REPO/$name"
  rsync -a --delete --exclude=.git "$SKILLS_DIR/$name/" "$REPO/$name/"
done

git -C "$REPO" add -- "$@"
if git -C "$REPO" diff --cached --quiet; then
  echo "publish-amp-skills: selected skills are already published"
  exit 0
fi

git -C "$REPO" diff --cached --check
git -C "$REPO" commit -m "docs: publish Amp skills: $*" -m \
  "Local dotfiles skill changes are not available to Amp orbs.

Sync the selected skills and their references to the personal skills
repository so new threads can use the current guidance."
git -C "$REPO" push origin main
echo "publish-amp-skills: published $*; new threads load them automatically"
