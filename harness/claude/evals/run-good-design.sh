#!/usr/bin/env bash
# Grade the descriptions of the good-design-dry, good-design-kiss, and good-design-solid skills.
#
# Modes:
#   desc — a judge sees only the three descriptions and the task, and picks the skills to load.
#          Grades whether the descriptions separate.
#   live — a real `claude -p` session runs the task in an empty dir with every installed skill,
#          and the runner reads the Skill calls. Grades whether the skills fire.
#
# A case's `expect` is a list: the skills that MUST load, ["any"] for at least one of the
# three, or [] for none of the three. Extra good-design skills on a code task are not a failure.
#
# Usage:
#   ./run-good-design.sh [-m desc|live] [-i <case-id>] [-v]
# Env:
#   MODEL=sonnet  THRESHOLD=0.85  REPEATS=2 (live only; a positive case passes on any run,
#   a [] case only on every run)
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skills_dir="$here/../skills"
cases="$here/cases-good-design.jsonl"
skills=(good-design-dry good-design-kiss good-design-solid)
model="${MODEL:-sonnet}"
threshold="${THRESHOLD:-0.85}"
repeats="${REPEATS:-2}"
mode=desc
only=""
verbose=0

while getopts "m:i:v" opt; do
  case "$opt" in
    m) mode="$OPTARG" ;;
    i) only="$OPTARG" ;;
    v) verbose=1 ;;
    *) exit 2 ;;
  esac
done
case "$mode" in desc|live) ;; *) echo "unknown mode: $mode" >&2; exit 2 ;; esac

for dep in claude jq; do
  command -v "$dep" >/dev/null || { echo "missing dependency: $dep" >&2; exit 2; }
done
[ -f "$cases" ] || { echo "missing $cases" >&2; exit 2; }

read_description() {
  awk '/^description:/{p=1} p && !/^description:/ && /^[a-z-]+:/{exit} /^---$/ && p{exit} p' "$1"
}

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

descriptions=""
for s in "${skills[@]}"; do
  d="$(read_description "$skills_dir/$s/SKILL.md")"
  [ -n "$d" ] || { echo "no description in $s" >&2; exit 2; }
  descriptions+="SKILL — name: $s"$'\n'"$d"$'\n\n'
done

# Prints the good-design skills one run picked or loaded, comma-separated.
judge_pick() {
  local prompt raw
  prompt="You are a Claude Code session. These skills are installed. You see ONLY their descriptions,
which is all a real session sees before it decides to load one.

$descriptions--- TASK ---
$1
--- END TASK ---

Which of these skills does this task load? Pick every skill that applies, or none.
Judge only from the descriptions and the task.

Reply with one line of JSON and nothing else:
{\"pick\":[\"<skill name>\", ...],\"why\":\"<12 words>\"}"
  raw="$(cd "$workdir" && claude -p --model "$model" --setting-sources project --strict-mcp-config \
    --disable-slash-commands "$prompt" 2>/dev/null)"
  grep -o '{.*}' <<<"$raw" | tail -1 | jq -r '.pick | join(",")' 2>/dev/null
}

live_fired() {
  local stream="$workdir/stream.$$.$RANDOM.jsonl"
  (cd "$workdir" && claude -p --model "$model" --output-format stream-json --verbose \
    "$1" </dev/null >"$stream" 2>/dev/null)
  jq -r 'select(.type=="assistant") | .message.content[]?
    | select(.type=="tool_use" and .name=="Skill") | .input.skill // empty' "$stream" 2>/dev/null \
    | grep -o 'good-design-[a-z]*' | sort -u | paste -sd, -
}

pick() { if [ "$mode" = desc ]; then judge_pick "$1"; else live_fired "$1"; fi; }

# 0 when one run's picks satisfy `expect`.
run_ok() {
  local want="$1" got="$2"
  case "$want" in
    "") [ -z "$got" ] ;;
    any) [ -n "$got" ] ;;
    *) for s in ${want//,/ }; do grep -qw "$s" <<<"$got" || return 1; done ;;
  esac
}

if [ "$mode" = live ]; then
  echo "preflight: does the control task fire good-design-dry?"
  control="$(live_fired "Is this code DRY? Check it for duplication.")"
  grep -q good-design-dry <<<"$control" || {
    echo "ABORT: the control task fired '${control:-nothing}'. Run 'mise run stow' and retry." >&2
    exit 3
  }
fi

runs=1; [ "$mode" = live ] && runs="$repeats"
pass=0; total=0
while IFS= read -r line; do
  [ -n "$line" ] || continue
  id="$(jq -r .id <<<"$line")"
  [ -z "$only" ] || [ "$only" = "$id" ] || continue
  task="$(jq -r .task <<<"$line")"
  want="$(jq -r '.expect | join(",")' <<<"$line")"

  hits=0; seen=""
  for ((r = 1; r <= runs; r++)); do
    got="$(pick "$task")"
    seen+="[${got:-none}]"
    run_ok "$want" "$got" && hits=$((hits + 1))
  done
  if [ -z "$want" ]; then ok=$((hits == runs)); else ok=$((hits > 0)); fi

  total=$((total + 1))
  if [ "$ok" -eq 1 ]; then verdict=PASS; pass=$((pass + 1)); else verdict=FAIL; fi
  printf '%s want=%-36s got=%-48s %s\n' "$verdict" "${want:-none}" "$seen" "$id"
  [ "$verbose" -eq 1 ] && jq -r '"     ↳ " + .note' <<<"$line"
done <"$cases"

[ "$total" -gt 0 ] || { echo "no cases ran" >&2; exit 2; }
acc="$(awk -v p="$pass" -v t="$total" 'BEGIN{printf "%.2f", p/t}')"
printf '\n%s: %d/%d  |  accuracy %s (threshold %s)\n' "$mode" "$pass" "$total" "$acc" "$threshold"
awk -v a="$acc" -v t="$threshold" 'BEGIN{exit !(a+0 >= t+0)}'
