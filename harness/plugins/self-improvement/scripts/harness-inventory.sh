#!/usr/bin/env bash
# Print the harness surface a lesson could land on. `harness-inventory.sh [repo-root...]`
#
#   <scope>  <path>  <name>  <trigger>
#
# This is the *trigger* surface, not the content: one row per skill, carrying
# only what decides whether that skill fires. A suggestion pass has to answer
# "does something already cover this?", and a `description` is exactly the field
# that answers it — the bodies are far too large to feed, and reading one is a
# tool call the pass can make for the single candidate it names.
#
# Rows come from the three places capture-lesson is allowed to write:
#   global   ~/.claude/skills/<slug>/SKILL.md
#   project  <repo>/.claude/skills/<slug>/SKILL.md, for each repo passed in
#   doc      the CLAUDE.md files that exist, global and per repo
#
# A skill stamped `origin: self-improvement` is marked `[auto]`. That mark is the
# point of the column: this harness has 90+ skills and almost all the autocreated
# ones fire rarely, so a pass that knows which rows were machine-written can
# prefer extending one over minting yet another.
set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# One skill: its name, its description folded to a single line, and whether it
# was autocreated. yq is not assumed — the frontmatter shapes here are `key:
# value` and `key: >` blocks, which awk handles without a YAML parser.
emit_skill() {
  local scope=$1 file=$2
  awk -v scope="$scope" -v file="$file" '
    NR == 1 && $0 != "---" { exit }
    NR > 1 && /^---[[:space:]]*$/ { done = 1; next }
    done { next }

    /^name:[[:space:]]/          { name = substr($0, 6); gsub(/^[[:space:]]+|[[:space:]]+$/, "", name); next }
    /^description:[[:space:]]*$/ { collecting = 1; next }
    /^description:[[:space:]]*>/ { collecting = 1; next }
    /^description:[[:space:]]/   { desc = substr($0, 13); collecting = 1; next }
    /^[a-zA-Z_-]+:/              { collecting = 0 }
    collecting && /^[[:space:]]+[^[:space:]]/ {
      line = $0; gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      desc = (desc == "" ? line : desc " " line)
      next
    }
    /origin:[[:space:]]*self-improvement/ { auto = 1 }

    END {
      if (name == "") { n = split(file, p, "/"); name = p[n - 1] }
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", desc)
      gsub(/\t/, " ", desc)
      printf "%s\t%s\t%s\t%s%s\n", scope, file, name, (auto ? "[auto] " : ""), desc
    }
  ' "$file"
}

for skill in "$HOME"/.claude/skills/*/SKILL.md; do
  [ -f "$skill" ] && emit_skill global "$skill"
done

for repo in "$@"; do
  [ -d "$repo" ] || continue
  for skill in "$repo"/.claude/skills/*/SKILL.md; do
    [ -f "$skill" ] && emit_skill project "$skill"
  done
  [ -f "$repo/CLAUDE.md" ] && printf 'doc\t%s\t%s\t%s\n' \
    "$repo/CLAUDE.md" "$(basename "$repo") CLAUDE.md" "project-wide rules for this repo"
done

for doc in "$HOME/.claude/CLAUDE.md" "$HOME/.claude/CODE_STYLE.md"; do
  [ -f "$doc" ] && printf 'doc\t%s\t%s\t%s\n' \
    "$doc" "$(basename "$doc")" "rules loaded into every session"
done

exit 0
