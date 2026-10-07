#!/usr/bin/env bash
# Let the grilling skill write whole rounds from real sessions, then check where each wrong decision lands.
#
# Each case is one real round: the material the model had, every open point it drafted, and the
# user's real answer to each point. The model writes the round file. A grader reads the file and,
# per point, says where it is (a [decide] block, a Decided line, or missing) and whether the
# decision or recommendation there agrees with the user's real answer.
#
#               agrees          wrong
#   block       needless        caught      — the user reads it
#   line        right           HIDDEN      — the user only scans it
#   missing     —               dropped     — it waits; priced as one block in a later round
#
# Each class has a price; the score is the sum, against the oracle that puts exactly the wrong
# decisions in blocks and the right ones in lines.
#
# The prompt MUST NOT name the choice to decide or to ask: v0.1.0 has neither, and a prompt that
# offers them grades the prompt instead of the skill.
#
# Usage:
#   ./run-grilling-rounds.sh                 # all rounds
#   ./run-grilling-rounds.sh -i <id>,<id>    # only these rounds (comma-separated)
#   ./run-grilling-rounds.sh -k              # keep the written round files and print their dir
#   ./run-grilling-rounds.sh -v              # print one row per point
# Env:
#   MODEL=opus            # model that writes the round (default: opus, the main session model)
#   GRADE_MODEL=haiku     # model that grades the round (default: haiku)
#   SKILL_REV=6402ad2     # grade SKILL.md at this git revision (default: working tree)
#   JOBS=8                # rounds written in parallel (default: 8)
#   NOCACHE=1             # write and grade every round again; the default reuses a stored reply
#   REPEATS=1             # times each round is written; the counts are summed (default: 1)
#   READ_BLOCK=2          # price of reading one block (default: 2)
#   READ_LINE=0.3         # price of scanning one Decided line (default: 0.3)
#   NOTICE_LINE=0.3       # chance the user notices a wrong Decided line (default: 0.3)
#   MAX_RATIO=2           # exit 0 when the skill's price is at most this many times the oracle's (default: 2)
#   PRICE_LOW=1 PRICE_MEDIUM=5 PRICE_HIGH=25   # price of each undo and find level
# The undo and find levels of each point (low|medium|high) are in the cases: run-grilling-jev.py --label-costs.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$here/lib-grilling.sh"

cases="$here/cases-grilling-rounds.jsonl"
repeats="${REPEATS:-1}"
read_block="${READ_BLOCK:-2}"
read_line="${READ_LINE:-0.3}"
notice_line="${NOTICE_LINE:-0.3}"
max_ratio="${MAX_RATIO:-2}"
price_low="${PRICE_LOW:-1}"
price_medium="${PRICE_MEDIUM:-5}"
price_high="${PRICE_HIGH:-25}"
only=""; keep=0; verbose=0

while getopts "i:kv" opt; do
  case "$opt" in
    i) only="$OPTARG" ;;
    k) keep=1 ;;
    v) verbose=1 ;;
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
block that puts one open point in front of the user starts with a heading line
\`### [decide] P<n>: <text>\`, where P<n> is that open point. Any other line about a point names
it as P<n>. You have no tools: reply with the full text of the round file and nothing else."
  grilling_judge_cached "$prompt" "$slot" > "$file"
  grade_round "$file" "$line"
}

# The user's real answer is the truth. An empty answer accepted the recommendation of the real round.
grade_round() {
  local file="$1" line="$2" truth prompt
  truth="$(jq -r '.blocks[] | select(.label != "skip") |
    "P\(.n). Original question: \(.candidate)\n    User'"'"'s real answer: \(if (.answer | test("^\\s*(\\(empty\\))?\\s*$")) then "(empty — accepted the recommendation in the original question)" else .answer end)"' <<<"$line")"
  prompt="Below is a round file that an assistant wrote for a user, and the user's real answer to each open
point. For each point, say:
- \"place\": \"block\" if a heading names it with [decide]; \"line\" if the file settles it anywhere
  else (a Decided line, a sentence, a recommendation); \"absent\" if the file does not settle it.
- \"agrees\": \"yes\" if the decision or recommendation the file gives for it is the one the user's
  real answer chose; \"no\" if it differs or the user's answer adds a fact or a meaning the file does
  not have; \"none\" if the file gives no decision for it.

--- ROUND FILE ---
$(cat "$file")
--- END ---

--- TRUTH ---
$truth
--- END ---

Reply with one line of JSON and nothing else, keyed by the bare number:
{\"3\":{\"place\":\"line\",\"agrees\":\"yes\"}}"
  GRILLING_MODEL_OVERRIDE="${GRADE_MODEL:-haiku}" grilling_judge_cached "$prompt" | grep -o '{.*}' | tail -1 > "$file.grade"
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

: > "$out/rows.tsv"
empty=0; ungraded=0
for i in $(seq 1 "$n"); do
  [ -f "$out/$i.case" ] || continue
  line="$(cat "$out/$i.case")"
  id="$(jq -r .id <<<"$line")"
  for r in $(seq 1 "$repeats"); do
    f="$out/$i.$r.md"
    [ -s "$f" ] || { empty=$((empty + 1)); continue; }
    jq -e . "$f.grade" >/dev/null 2>&1 || { ungraded=$((ungraded + 1)); continue; }
    blocks=" $(grep -oE '^#+ *\[decide\] *P[0-9]+' "$f" | grep -oE '[0-9]+$' | sort -un | tr '\n' ' ')"
    while IFS=$'\t' read -r pn label pain undo find; do
      [ "$label" = skip ] && continue
      place="$(jq -r --arg k "$pn" '.[$k].place // "absent"' "$f.grade")"
      agrees="$(jq -r --arg k "$pn" '.[$k].agrees // "none"' "$f.grade")"
      [[ "$blocks" == *" $pn "* ]] && place=block
      case "$place/$agrees" in
        block/yes) class=needless ;;
        block/*)   class=caught ;;
        line/yes)  class=right ;;
        line/*)    class=hidden ;;
        *)         class=dropped ;;
      esac
      printf '%s\t%s\tP%s\t%s\t%s\t%s\t%s\n' "$id" "$r" "$pn" "$pain" "$class" "$undo" "$find" >> "$out/rows.tsv"
    done < <(jq -r '.blocks[] | [.n, .label, .pain, (.undo // "medium"), (.find // "medium")] | @tsv' <<<"$line")
  done
done

[ -s "$out/rows.tsv" ] || { echo "no rounds graded" >&2; exit 2; }
[ "$verbose" -eq 0 ] || awk -F'\t' '{printf "  %-8s %-17s %-42s #%s %s\n", $5, $4, $1, $2, $3}' "$out/rows.tsv"

printf '%-42s %6s %6s %8s %7s %7s %7s\n' "round" "blocks" "lines" "needless" "caught" "HIDDEN" "dropped"
awk -F'\t' '
  { k=$1; c[k,$5]++; ids[k]=1; t[$5]++ }
  END {
    for (k in ids) printf "%-42s %6d %6d %8d %7d %7d %7d\n", k, c[k,"needless"]+c[k,"caught"], c[k,"right"]+c[k,"hidden"], c[k,"needless"]+0, c[k,"caught"]+0, c[k,"hidden"]+0, c[k,"dropped"]+0
    printf "%-42s %6d %6d %8d %7d %7d %7d\n", "TOTAL", t["needless"]+t["caught"], t["right"]+t["hidden"], t["needless"]+0, t["caught"]+0, t["hidden"]+0, t["dropped"]+0
  }' "$out/rows.tsv" | sort -k1,1 | awk '/^TOTAL/{last=$0; next} {print} END{print last}'

printf '\n%-17s %8s %7s %7s\n' "pain point" "needless" "HIDDEN" "dropped"
awk -F'\t' '$5=="needless"||$5=="hidden"||$5=="dropped" { c[$4,$5]++; k[$4]=1 }
  END { for (p in k) printf "%-17s %8d %7d %7d\n", p, c[p,"needless"]+0, c[p,"hidden"]+0, c[p,"dropped"]+0 }' \
  "$out/rows.tsv" | sort -k3,3nr -k2,2nr

read -r needless caught right hidden dropped < <(awk -F'\t' '{ c[$5]++ }
  END { print c["needless"]+0, c["caught"]+0, c["right"]+0, c["hidden"]+0, c["dropped"]+0 }' "$out/rows.tsv")
wrong=$((caught + hidden + dropped)); blocks=$((needless + caught))
printf '\nskill %s: %d points, %d decisions wrong — %d caught in a block, %d hidden in a line, %d dropped\n' \
  "$(grilling_skill_label)" "$((wrong + needless + right))" "$wrong" "$caught" "$hidden" "$dropped"
printf 'you read %d blocks (%d only to accept) and scan %d lines\n' "$blocks" "$needless" "$((right + hidden))"

# Price of one point = the reading its place costs + for a wrong decision, the chance it is missed
# there × (the price to find it in the code review + the price to undo it). A Decided line is read
# in passing, so a wrong one is noticed only sometimes.
awk -F'\t' -v rb="$read_block" -v rl="$read_line" -v nl="$notice_line" \
  -v pl="$price_low" -v pm="$price_medium" -v ph="$price_high" '
  function level(word) { return word == "low" ? pl : word == "high" ? ph : pm }
  function price(place, wrong, undo, find,   read, notice) {
    if (place == "absent") return rb  # it waits and comes back as a block in a later round
    read = place == "block" ? rb : place == "line" ? rl : 0
    notice = place == "block" ? 1 : place == "line" ? nl : 0
    return read + (wrong ? (1 - notice) * (level(find) + level(undo)) : 0)
  }
  {
    place = ($5 == "needless" || $5 == "caught") ? "block" : ($5 == "dropped" ? "absent" : "line")
    wrong = ($5 == "caught" || $5 == "hidden" || $5 == "dropped")
    skill += price(place, wrong, $6, $7)
    askall += rb
    oracle += wrong ? rb : rl
    silent += price("line", wrong, $6, $7)
    if ($5 == "hidden" || $5 == "dropped") miss[$4] += price(place, wrong, $6, $7) - rl
  }
  END {
    printf "\nprice (lower is better):  skill %.0f  |  oracle %.0f  |  ask every point %.0f  |  same decisions, all as lines %.0f\n", skill, oracle, askall, silent
    printf "price of the hidden and dropped wrong decisions by pain point:"
    for (p in miss) printf "  %s=%.0f", p, miss[p]
    printf "\n"
    printf "%.4f %.4f\n", skill, oracle > "/dev/stderr"
  }' "$out/rows.tsv" 2> "$out/price.txt"
read -r price_skill price_oracle < "$out/price.txt"
[ "$empty" -eq 0 ] || printf 'WARNING: %d round writes came back empty — re-run before you read the score\n' "$empty"
[ "$ungraded" -eq 0 ] || printf 'WARNING: %d rounds have no grade — re-run with NOCACHE=1 before you read the score\n' "$ungraded"
[ "$keep" -eq 0 ] || printf 'round files: %s\n' "$out"

awk -v s="$price_skill" -v o="$price_oracle" -v m="$max_ratio" -v e="$((empty + ungraded))" \
  'BEGIN{exit !(s+0 <= o * m && e+0 == 0)}'
