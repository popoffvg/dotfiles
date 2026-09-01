#!/usr/bin/env bash
# Grade the DESCRIPTIONS of the two naming skills against labelled task prompts.
#
# One axis per case:
#   pick — searchable-names | pedant | none : which skill a session loads for this task
#
# The two descriptions are read live from their SKILL.md frontmatter, so the eval always
# grades the current triggers. Nothing else from either skill reaches the judge: a
# description that needs the body to be understood has already failed.
#
# Usage:
#   ./run-names.sh                 # all cases
#   ./run-names.sh -i <case-id>    # one case
#   ./run-names.sh -v              # print the model's rationale per case
# Env:
#   MODEL=sonnet                   # model passed to `claude -p` (default: sonnet)
#   THRESHOLD=0.85                 # minimum accuracy to exit 0 (default: 0.85)
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
names_skill="$here/../skills/searchable-names/SKILL.md"
pedant_skill="$here/../skills/pedant/SKILL.md"
cases="$here/cases-searchable-names.jsonl"
model="${MODEL:-sonnet}"
threshold="${THRESHOLD:-0.85}"
only=""
verbose=0

while getopts "i:v" opt; do
  case "$opt" in
    i) only="$OPTARG" ;;
    v) verbose=1 ;;
    *) exit 2 ;;
  esac
done

for dep in claude jq; do
  command -v "$dep" >/dev/null || { echo "missing dependency: $dep" >&2; exit 2; }
done

# The description block only: from `description:` to the next frontmatter key or the closing ---.
read_description() {
  awk '/^description:/{p=1} p && NR>1 && /^[a-z-]+:/ && !/^description:/{exit} /^---$/ && p{exit} p' "$1"
}

for f in "$names_skill" "$pedant_skill" "$cases"; do
  [ -f "$f" ] || { echo "missing $f" >&2; exit 2; }
done

names_desc="$(read_description "$names_skill")"
pedant_desc="$(read_description "$pedant_skill")"
[ -n "$names_desc" ]  || { echo "could not extract description from $names_skill" >&2; exit 2; }
[ -n "$pedant_desc" ] || { echo "could not extract description from $pedant_skill" >&2; exit 2; }

pass=0; fail=0; total=0

while IFS= read -r line; do
  [ -n "$line" ] || continue
  id="$(jq -r .id <<<"$line")"
  [ -z "$only" ] || [ "$only" = "$id" ] || continue

  task="$(jq -r .task <<<"$line")"
  want="$(jq -r .pick <<<"$line")"

  prompt="You are a Claude Code session. Two skills are installed. You see ONLY their descriptions —
that is all a real session sees before it decides to load one.

SKILL A — name: searchable-names
$names_desc

SKILL B — name: pedant
$pedant_desc

--- TASK ---
$task
--- END TASK ---

Which skill does this task load?
  \"searchable-names\" = skill A applies.
  \"pedant\"           = skill B applies.
  \"none\"             = neither description covers this task; loading either would be noise.

Pick exactly one. Judge only from the two descriptions above and the task. Do not guess at
what the skill bodies might contain.

Reply with one line of JSON and nothing else:
{\"pick\":\"searchable-names|pedant|none\",\"why\":\"<12 words>\"}"

  # Neutral cwd + no user settings + skill-blind: the judge must answer from the two
  # descriptions in the prompt, not from the skills installed on this machine.
  raw="$(cd "${TMPDIR:-/tmp}" && claude -p --model "$model" \
    --setting-sources project --strict-mcp-config \
    --disable-slash-commands "$prompt" 2>/dev/null)"
  got="$(grep -o '{.*}' <<<"$raw" | tail -1)"
  got_pick="$(jq -r '.pick // "?"' <<<"$got" 2>/dev/null || echo '?')"
  why="$(jq -r '.why // ""' <<<"$got" 2>/dev/null || echo '')"

  total=$((total + 1))
  if [ "$got_pick" = "$want" ]; then
    verdict=PASS; pass=$((pass + 1))
  else
    verdict=FAIL; fail=$((fail + 1))
  fi

  printf '%s want=%-17s got=%-17s %s\n' "$verdict" "$want" "$got_pick" "$id"
  [ "$verbose" -eq 1 ] && [ -n "$why" ] && printf '     ↳ %s\n' "$why"
done < "$cases"

[ "$total" -gt 0 ] || { echo "no cases ran" >&2; exit 2; }

acc="$(awk -v p="$pass" -v t="$total" 'BEGIN{printf "%.2f", p/t}')"
printf '\n%d/%d  |  accuracy %s (threshold %s)\n' "$pass" "$total" "$acc" "$threshold"

awk -v a="$acc" -v t="$threshold" 'BEGIN{exit !(a+0 >= t+0)}'
