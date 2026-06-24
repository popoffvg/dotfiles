#!/usr/bin/env bash
# Re-home wm plan-* skills into the dotfiles repo as REAL dirs (de-symlink),
# rename plan->spec (dir names + frontmatter + cross-refs + artifact filenames + commands),
# and normalize the notes dir to .notes. Idempotent.
#
# Source of truth before: ~/.pi/agent/skills/plan*  (live global store, symlinked from repo)
# Source of truth after:  harness/plugins/wm/common/skills/spec*  (real files in repo)
#
# Usage: rehome-spec-skills.sh [REPO_ROOT]   (default: ~/Documents/git/dotfiles)
set -euo pipefail

REPO="${1:-$HOME/Documents/git/dotfiles}"
SKILLS="$REPO/harness/plugins/wm/common/skills"
STORE="$HOME/.pi/agent/skills"

# old:new skill dir mapping
MAP=(
  "plan:spec"
  "plan-flow:spec-flow"
  "plan-revise:spec-revise"
  "plan-todo-prepare:spec-todo-prepare"
  "plan-prototype:spec-prototype"
  "plan-code-map:spec-code-map"
  "plan-verifier:spec-verifier"
)

echo "== Step 1: re-home (de-symlink) =="
for pair in "${MAP[@]}"; do
  old="${pair%%:*}"; new="${pair##*:}"
  src="$SKILLS/$old"; dst="$SKILLS/$new"
  [ -e "$dst" ] && { echo "exists, skip: $new"; continue; }
  if [ -L "$src" ]; then
    real="$(readlink "$src")"            # absolute path into the store
    rm "$src"
    cp -RL "$real" "$dst"                # dereference: copy real content
    echo "rehomed: $old -> $new (from $real)"
  elif [ -d "$src" ]; then
    git -C "$REPO" mv "$src" "$dst" 2>/dev/null || mv "$src" "$dst"
    echo "moved real dir: $old -> $new"
  else
    echo "MISSING source: $src" >&2
  fi
done

echo "== Step 2: rename content inside spec-* dirs =="
# identifiers + filenames (safe, delimited where possible)
ID_PAIRS=(
  "plan-flow:spec-flow"
  "plan-revise:spec-revise"
  "plan-todo-prepare:spec-todo-prepare"
  "plan-prototype:spec-prototype"
  "plan-code-map:spec-code-map"
  "plan-verifier:spec-verifier"
)
for new in spec spec-flow spec-revise spec-todo-prepare spec-prototype spec-code-map spec-verifier; do
  dir="$SKILLS/$new"
  [ -d "$dir" ] || continue
  while IFS= read -r f; do
    # frontmatter name: (plan / plan-create variants land as spec)
    perl -i -pe 's/^(name:\s*)plan-create\b/${1}spec-create/; s/^(name:\s*)plan\b/${1}spec/; s/^(name:\s*)plan-/${1}spec-/' "$f"
    # skill cross-refs: plan-X -> spec-X  (longest first, word-bounded)
    for p in "${ID_PAIRS[@]}"; do o="${p%%:*}"; n="${p##*:}"; perl -i -pe "s/\\b\\Q${o}\\E\\b/${n}/g" "$f"; done
    # bare @plan-todo-prepare etc already covered; bare 'plan' skill mention @plan
    perl -i -pe 's/\@plan\b(?![-\w])/\@spec/g' "$f"
    # command
    perl -i -pe 's{/work:plan-revise}{/work:spec-revise}g' "$f"
    # artifact filenames
    perl -i -pe 's/\bplan-verify\.md\b/spec-verify.md/g; s/\bplan\.md\b/spec.md/g' "$f"
    # notes dir normalize: _notes -> .notes  (leave <notes-dir> placeholder)
    perl -i -pe 's/(?<![\w.])_notes\b/.notes/g' "$f"
    # prose nouns: plan/Plan/plans/Plans -> spec  (NOT planning, NOT planner)
    perl -i -pe 's/\bplanning\b/__KEEPING__/g; s/\bplanner\b/__KEEPER__/g' "$f"
    perl -i -pe 's/\bPlans\b/Specs/g; s/\bplans\b/specs/g; s/\bPlan\b/Spec/g; s/\bplan\b/spec/g' "$f"
    perl -i -pe 's/__KEEPING__/planning/g; s/__KEEPER__/planner/g' "$f"
  done < <(find "$dir" -type f -name '*.md')
  echo "renamed content: $new"
done

echo "== Done. Review git diff, then stow. Stale store dirs (plan*, work-plan*) cleaned separately. =="
