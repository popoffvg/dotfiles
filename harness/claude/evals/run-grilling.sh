#!/usr/bin/env bash
# Grade the grilling skill's question filter against labelled blocks from real grill sessions.
#
# One axis per case — what the grilling model does with one open point:
#   ask    — it becomes a [decide] block for the user
#   decide — the model settles it and lists it under Decided
#   defer  — it waits for the next round, because its parent question is open
#
# Every case was asked in a real session, so each decide or defer case is one needless
# question that a real round contained. The report groups the cases by pain point.
#
# Usage:
#   ./run-grilling.sh                 # all cases
#   ./run-grilling.sh -i <case-id>    # one case
#   ./run-grilling.sh -p <pain>       # the cases of one pain point
#   ./run-grilling.sh -v              # print the judge's rationale per case
# Env:
#   MODEL=sonnet                      # model passed to `claude -p` (default: sonnet)
#   SKILL_REV=6402ad2                 # grade SKILL.md at this git revision (default: working tree)
#   JOBS=4                            # judge calls in parallel (default: 4)
#   THRESHOLD=0.85                    # minimum accuracy to exit 0 (default: 0.85)
#   MAX_OVER_ASK=1                    # maximum needless questions to exit 0 (default: 1)
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$here/lib-grilling.sh"

cases="$here/cases-grilling.jsonl"
threshold="${THRESHOLD:-0.85}"
max_over_ask="${MAX_OVER_ASK:-1}"
only=""; only_pain=""; verbose=0

while getopts "i:p:v" opt; do
  case "$opt" in
    i) only="$OPTARG" ;;
    p) only_pain="$OPTARG" ;;
    v) verbose=1 ;;
    *) exit 2 ;;
  esac
done

[ -f "$cases" ] || { echo "no cases-grilling.jsonl at $cases" >&2; exit 2; }
skill_body="$(grilling_skill_body)" || exit 2
out="$(mktemp -d)"; trap 'rm -rf "$out"' EXIT

judge_case() {
  local n="$1" line="$2"
  local caller context candidate prompt raw
  caller="$(jq -r .caller <<<"$line")"
  context="$(jq -r .context <<<"$line")"
  candidate="$(jq -r .candidate <<<"$line")"
  prompt="You run the grilling skill below. Apply it literally.

$skill_body

--- SESSION ---
Caller: $caller

What you know before you write this round:
$context

The open point you drafted as a question:
$candidate
--- END SESSION ---

Decide what happens to this one open point in the round you write now.

\"ask\"    = it goes into the round as a [decide] block for the user.
\"decide\" = you settle it yourself and list it under Decided with its source.
\"defer\"  = it depends on a question that is still open in this round, so it waits for the next round.

Judge only from what you know above. Reply with one line of JSON and nothing else:
{\"label\":\"ask|decide|defer\",\"why\":\"<12 words>\"}"
  raw="$(grilling_judge_cached "$prompt")"
  grep -o '{.*}' <<<"$raw" | tail -1 > "$out/$n.json"
}

n=0
while IFS= read -r line; do
  [ -n "$line" ] || continue
  n=$((n + 1))
  id="$(jq -r .id <<<"$line")"; pain="$(jq -r .pain <<<"$line")"
  [ -z "$only" ] || [ "$only" = "$id" ] || continue
  [ -z "$only_pain" ] || [ "$only_pain" = "$pain" ] || continue
  printf '%s\n' "$line" > "$out/$n.case"
  judge_case "$n" "$line" &
  grilling_throttle
done < "$cases"
wait

pass=0; total=0; over_ask=0; under_ask=0
: > "$out/rows.tsv"
for i in $(seq 1 "$n"); do
  [ -f "$out/$i.case" ] || continue
  k="$out/$i"; line="$(cat "$k.case")"
  id="$(jq -r .id <<<"$line")"; want="$(jq -r .label <<<"$line")"
  pain="$(jq -r .pain <<<"$line")"; caller="$(jq -r .caller <<<"$line")"
  got="$(jq -r '.label // "?"' "$k.json" 2>/dev/null || echo '?')"
  why="$(jq -r '.why // ""' "$k.json" 2>/dev/null || echo '')"
  [ -n "$got" ] || got="?"

  total=$((total + 1)); err=""
  if [ "$got" = "$want" ]; then
    verdict=PASS; pass=$((pass + 1))
  else
    verdict=FAIL
    if [ "$got" = ask ]; then err=over-ask; over_ask=$((over_ask + 1))
    elif [ "$want" = ask ]; then err=under-ask; under_ask=$((under_ask + 1))
    else err=mislabel; fi
  fi
  printf '%s\t%s\t%s\t%s\n' "$pain" "$want" "$verdict" "$err" >> "$out/rows.tsv"

  printf '%s want=%-6s got=%-6s %-16s %-17s %s\n' "$verdict" "$want" "$got" "$pain" "$caller" "$id"
  [ "$verbose" -eq 1 ] && [ -n "$why" ] && printf '     ↳ %s\n' "$why"
done

[ "$total" -gt 0 ] || { echo "no cases ran" >&2; exit 2; }

printf '\n%-17s %-7s %5s %6s  %s\n' "pain point" "gold" "cases" "pass" "errors"
awk -F'\t' '
  { k=$1; gold[k]=$2; n[k]++; if ($3=="PASS") p[k]++; if ($4!="") e[k]=e[k] (e[k]==""?"":",") $4 }
  END { for (k in n) printf "%-17s %-7s %5d %6d  %s\n", k, gold[k], n[k], p[k]+0, e[k] }
' "$out/rows.tsv" | sort -k2,2 -k1,1

needless="$(awk -F'\t' '$2!="ask"' "$out/rows.tsv" | wc -l | tr -d ' ')"
acc="$(awk -v p="$pass" -v t="$total" 'BEGIN{printf "%.2f", p/t}')"
printf '\nreal sessions asked all %d; %d of them were needless\n' "$total" "$needless"
printf 'skill %s: %d/%d  |  over-ask %d/%d  |  under-ask %d/%d  |  accuracy %s (threshold %s, max over-ask %s)\n' \
  "$(grilling_skill_label)" "$pass" "$total" "$over_ask" "$needless" "$under_ask" "$((total - needless))" \
  "$acc" "$threshold" "$max_over_ask"

awk -v a="$acc" -v t="$threshold" -v o="$over_ask" -v m="$max_over_ask" \
  'BEGIN{exit !(a+0 >= t+0 && o+0 <= m+0)}'
