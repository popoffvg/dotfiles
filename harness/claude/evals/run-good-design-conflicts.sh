#!/usr/bin/env bash
# Find the trade-offs where the good-design skills contradict each other.
#
# Each case is a small code context, a task, and two designs, A and B, that the rules pull
# apart. The model gets the full text of good-design-dry, good-design-kiss, and
# good-design-solid, picks A or B, and names the rule slugs for and against its pick.
# Each case runs REPEATS times.
#
#   stable   — the same pick on every run. A pick that changes means the skills give no answer.
#   gold     — the pick the skill text or the operator's review settles; null when nothing does.
#   against  — the slugs the model named against its own pick: the contradiction to fix.
#
# Usage:
#   ./run-good-design-conflicts.sh [-i <id-regex>] [-v]
# Env:
#   MODEL=sonnet  REPEATS=3  JOBS=4
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skills_dir="$here/../skills"
cases="$here/cases-good-design-conflicts.jsonl"
model="${MODEL:-sonnet}"
repeats="${REPEATS:-3}"
jobs="${JOBS:-4}"
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

skills_text=""
for s in good-design-dry good-design-kiss good-design-solid; do
  skills_text+="===== SKILL $s ====="$'\n'"$(awk 'c >= 2; /^---$/ { c++ }' "$skills_dir/$s/SKILL.md")"$'\n\n'
done
caller_text="$(sed -n '/^## For the caller/,/^## Input/p' "$here/../agents/good-design-verifier.md" | sed '$d')"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

# Writes one run's JSON answer to $2.
ask() {
  local line="$1" out="$2" prompt
  prompt="You are a coding agent. These are your design instructions, in full:

$skills_text
===== For the caller (from the good-design-verifier agent) =====
$caller_text

--- CODE CONTEXT ---
$(jq -r .context <<<"$line")
--- TASK FROM THE USER ---
$(jq -r .task <<<"$line")
--- DESIGN A ---
$(jq -r .a <<<"$line")
--- DESIGN B ---
$(jq -r .b <<<"$line")
---

Pick the design your instructions require. Name the rule slugs (from the check tables, or a step name in kebab-case) that decide for your pick, and the slugs that argue against it.
Reply with one line of JSON and nothing else:
{\"pick\":\"A|B\",\"for\":[\"<slug>\"],\"against\":[\"<slug>\"],\"why\":\"<20 words>\"}"
  (cd "$workdir" && claude -p --model "$model" --setting-sources project --strict-mcp-config \
    --disable-slash-commands "$prompt" 2>/dev/null) | grep -o '{.*}' | tail -1 >"$out"
}

ids=()
while IFS= read -r line; do
  [ -n "$line" ] || continue
  id="$(jq -r .id <<<"$line")"
  [ -z "$only" ] || [[ "$id" =~ $only ]] || continue
  ids+=("$id")
  for ((r = 1; r <= repeats; r++)); do
    while [ "$(jobs -rp | wc -l)" -ge "$jobs" ]; do wait -n; done
    ask "$line" "$workdir/$id.$r.json" &
  done
done <"$cases"
wait
[ "${#ids[@]}" -gt 0 ] || { echo "no cases ran" >&2; exit 2; }

stable_n=0; gold_n=0; gold_hit=0
printf '%-30s %-6s %-7s %-5s %s\n' case picks stable gold against
for id in "${ids[@]}"; do
  line="$(grep "\"id\": \"$id\"" "$cases")"
  gold="$(jq -r '.gold // "-"' <<<"$line")"
  picks="$(for f in "$workdir/$id".*.json; do jq -r '.pick // "?"' "$f" 2>/dev/null || echo '?'; done | tr -d '\n')"
  against="$(cat "$workdir/$id".*.json 2>/dev/null | jq -r '.against[]?' 2>/dev/null | sort | uniq -c | sort -rn | awk '{printf "%s%s(%s)", (NR>1?",":""), $2, $1}')"
  uniq_picks="$(fold -w1 <<<"$picks" | sort -u | tr -d '\n')"
  stable=no; [ "${#uniq_picks}" -eq 1 ] && [ "$uniq_picks" != "?" ] && { stable=yes; stable_n=$((stable_n + 1)); }
  if [ "$gold" != "-" ]; then
    gold_n=$((gold_n + 1))
    [ "$stable" = yes ] && [ "$uniq_picks" = "$gold" ] && gold_hit=$((gold_hit + 1))
  fi
  printf '%-30s %-6s %-7s %-5s %s\n' "$id" "$picks" "$stable" "$gold" "${against:--}"
  if [ "$verbose" -eq 1 ]; then
    for f in "$workdir/$id".*.json; do jq -r '"     ↳ " + .pick + ": " + .why' "$f" 2>/dev/null; done
  fi
done

printf '\nstable %d/%d  |  gold %d/%d\n' "$stable_n" "${#ids[@]}" "$gold_hit" "$gold_n"
