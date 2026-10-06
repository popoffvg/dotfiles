#!/usr/bin/env bash
# Let the grilling skill write whole rounds from real sessions, then count the needless questions.
#
# Each case is one real round: the material the model had, and every open point it drafted.
# The model writes the round file. A point in a [decide] block is asked; every other point is not.
# The prompt MUST NOT name the choice to decide or to wait: v0.1.0 has neither, and a prompt
# that offers them grades the prompt instead of the skill.
# Gold labels come from the user's real answers.
#
# Usage:
#   ./run-grilling-rounds.sh                 # all rounds
#   ./run-grilling-rounds.sh -i <id>,<id>     # only these rounds (comma-separated)
#   ./run-grilling-rounds.sh -k              # keep the written round files and print their dir
# Env:
#   MODEL=sonnet          # model passed to `claude -p` (default: sonnet)
#   SKILL_REV=6402ad2     # grade SKILL.md at this git revision (default: working tree)
#   JOBS=8                # rounds written in parallel (default: 8)
#   NOCACHE=1             # write every round again; the default reuses a stored reply for the same prompt
#   REPEATS=1             # times each round is written; the counts are summed (default: 1)
#   MAX_NEEDLESS=0.25     # maximum share of asked blocks that are needless, to exit 0 (default: 0.25)
#   MAX_MISSED=0.2        # maximum share of needed questions not asked, to exit 0 (default: 0.2)
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$here/lib-grilling.sh"

cases="$here/cases-grilling-rounds.jsonl"
repeats="${REPEATS:-1}"
max_needless="${MAX_NEEDLESS:-0.25}"
max_missed="${MAX_MISSED:-0.2}"
only=""; keep=0

while getopts "i:k" opt; do
  case "$opt" in
    i) only="$OPTARG" ;;
    k) keep=1 ;;
    *) exit 2 ;;
  esac
done

[ -f "$cases" ] || { echo "no cases-grilling-rounds.jsonl at $cases" >&2; exit 2; }
skill_body="$(grilling_skill_body)" || exit 2
out="$(mktemp -d)"
[ "$keep" -eq 1 ] || trap 'rm -rf "$out"' EXIT

write_round() {
  local file="$1" line="$2" slot="$3" caller context points prompt
  caller="$(jq -r .caller <<<"$line")"
  context="$(jq -r .context <<<"$line")"
  points="$(jq -r '.blocks[] | "P\(.n). \(.candidate)"' <<<"$line")"
  prompt="You run the grilling skill below. Follow it literally.

$skill_body

--- SESSION ---
Caller: $caller

What you know (the sources you can read are quoted here; nothing else exists):
$context

The open points you listed in step 1, each as you first drafted it:
$points
--- END SESSION ---

Write the next round file now, as the skill tells you. One format rule for this session: each
question block for the user starts with a heading line \`### [decide] P<n>: <question>\`, where
P<n> is the open point it asks about. You have no tools: reply with the full text of the round
file and nothing else."
  grilling_judge_cached "$prompt" "$slot" > "$file"
  classify_round "$file" "$line"
}

# A point with no question block was either settled in the round or left for a later one.
# A needed question that waits is not a miss: the five-question cap and root-first order force it.
classify_round() {
  local file="$1" line="$2" asked rest prompt
  asked=" $(grep -oE '^#+ *\[decide\] *P[0-9]+' "$file" | grep -oE '[0-9]+$' | sort -un | tr '\n' ' ')"
  rest="$(jq -r '.blocks[].n' <<<"$line" | while read -r pn; do [[ "$asked" == *" $pn "* ]] || printf 'P%s ' "$pn"; done)"
  [ -n "$rest" ] || { echo '{}' > "$file.cls"; return; }
  prompt="Below is a round file that an assistant wrote for a user. For each of these points: $rest
say what the round does with it:
\"decided\" = the round states a choice for it (a Decided line, or a sentence that settles it).
\"waits\"   = the round says it waits for a later round or depends on an open question.
\"absent\"  = the round does not mention it.

--- ROUND FILE ---
$(cat "$file")
--- END ---

Reply with one line of JSON and nothing else, keyed by the bare number: {\"3\":\"decided\",\"5\":\"waits\"}"
  GRILLING_MODEL_OVERRIDE="${CLASSIFY_MODEL:-haiku}" grilling_judge_cached "$prompt" | grep -o '{.*}' | tail -1 > "$file.cls"
}

n=0
while IFS= read -r line; do
  [ -n "$line" ] || continue
  n=$((n + 1))
  id="$(jq -r .id <<<"$line")"
  [ -z "$only" ] || [[ ",$only," == *",$id,"* ]] || continue
  printf '%s\n' "$line" > "$out/$n.case"
  for r in $(seq 1 "$repeats"); do
    write_round "$out/$n.$r.md" "$line" "$r" &
    grilling_throttle
  done
done < "$cases"
wait

printf '%-42s %6s %6s %6s %8s %7s %7s\n' "round" "real" "needed" "asked" "needless" "waited" "missed"
: > "$out/pain.tsv"
t_real=0; t_needed=0; t_asked=0; t_needless=0; t_waited=0; t_missed=0; oversize=0; empty=0; no_heading=""
for i in $(seq 1 "$n"); do
  [ -f "$out/$i.case" ] || continue
  line="$(cat "$out/$i.case")"
  id="$(jq -r .id <<<"$line")"
  real=0; needed=0; asked=0; needless=0; waited=0; missed=0
  for r in $(seq 1 "$repeats"); do
    f="$out/$i.$r.md"
    [ -s "$f" ] || { empty=$((empty + 1)); continue; }
    asked_set=" $(grep -oE '^#+ *\[decide\] *P[0-9]+' "$f" | grep -oE '[0-9]+$' | sort -un | tr '\n' ' ')"
    [ -n "${asked_set// /}" ] || no_heading="$no_heading $id#$r"
    [ "$(wc -w <<<"$asked_set")" -le 5 ] || oversize=$((oversize + 1))
    while IFS=$'\t' read -r pn label pain; do
      [ "$label" = skip ] && continue
      real=$((real + 1))
      [ "$label" = ask ] && needed=$((needed + 1))
      if [[ "$asked_set" == *" $pn "* ]]; then
        asked=$((asked + 1))
        if [ "$label" != ask ]; then
          needless=$((needless + 1)); printf '%s\tneedless\n' "$pain" >> "$out/pain.tsv"
        fi
      elif [ "$label" = ask ]; then
        if [ "$(jq -r --arg k "$pn" '.[$k] // "absent"' "$f.cls" 2>/dev/null)" = waits ]; then
          waited=$((waited + 1))
        else
          missed=$((missed + 1)); printf '%s\tmissed\n' "$pain" >> "$out/pain.tsv"
        fi
      fi
    done < <(jq -r '.blocks[] | [.n, .label, .pain] | @tsv' <<<"$line")
  done
  printf '%-42s %6d %6d %6d %8d %7d %7d\n' "$id" "$real" "$needed" "$asked" "$needless" "$waited" "$missed"
  t_real=$((t_real + real)); t_needed=$((t_needed + needed)); t_asked=$((t_asked + asked))
  t_needless=$((t_needless + needless)); t_waited=$((t_waited + waited)); t_missed=$((t_missed + missed))
done

[ "$t_real" -gt 0 ] || { echo "no rounds ran" >&2; exit 2; }
printf '%-42s %6d %6d %6d %8d %7d %7d\n' "TOTAL" "$t_real" "$t_needed" "$t_asked" "$t_needless" "$t_waited" "$t_missed"

printf '\n%-17s %8s %7s\n' "pain point" "needless" "missed"
awk -F'\t' '{ if ($2=="needless") a[$1]++; else b[$1]++; k[$1]=1 }
  END { for (p in k) printf "%-17s %8d %7d\n", p, a[p]+0, b[p]+0 }' "$out/pain.tsv" | sort -k2,2nr -k3,3nr

needless_share="$(awk -v a="$t_needless" -v b="$t_asked" 'BEGIN{printf "%.2f", (b ? a/b : 0)}')"
missed_share="$(awk -v a="$t_missed" -v b="$t_needed" 'BEGIN{printf "%.2f", (b ? a/b : 0)}')"
real_share="$(awk -v a="$t_needed" -v b="$t_real" 'BEGIN{printf "%.2f", 1 - a/b}')"
printf '\nreal sessions: asked %d, needed %d — %s of the questions were needless\n' "$t_real" "$t_needed" "$real_share"
printf 'skill %s: asked %d, needless %d (%s), missed %d of %d needed (%s), waited %d, rounds over 5 questions: %d\n' \
  "$(grilling_skill_label)" "$t_asked" "$t_needless" "$needless_share" "$t_missed" "$t_needed" "$missed_share" "$t_waited" "$oversize"
[ "$empty" -eq 0 ] || printf 'WARNING: %d round writes came back empty — re-run before you read the score\n' "$empty"
[ -z "$no_heading" ] || printf 'no question heading (asks nothing, or ignored the format — read with -k):%s\n' "$no_heading"
[ "$keep" -eq 0 ] || printf 'round files: %s\n' "$out"

awk -v a="$needless_share" -v m="$max_needless" -v b="$missed_share" -v x="$max_missed" -v e="$empty" \
  'BEGIN{exit !(a+0 <= m+0 && b+0 <= x+0 && e+0 == 0)}'
