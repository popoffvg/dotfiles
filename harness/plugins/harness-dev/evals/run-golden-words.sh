#!/usr/bin/env bash
# Two-arm check of every golden word in cases-golden-words.jsonl.
#
# Per case, on the case's reader tier, N runs each:
#   word    — the task with "Write it as <word>."
#   no-word — the task with the rules written out and no word
# A judge marks each rule of the case kept or broken in every output.
# A word PASSES when the word arm keeps every rule in N of N runs.
# The no-word column is printed beside it: a rule both arms keep equally
# is carried by the rules, not the word.
#
# Usage:
#   ./run-golden-words.sh                 # all cases
#   ./run-golden-words.sh -i <case-id>    # one case
#   ./run-golden-words.sh -v              # print each judge verdict
# Env:
#   RUNS=3          # runs per arm (default: 3)
#   JUDGE=opus      # judge model (default: opus)
#   TIER=<model>    # override every case's reader tier
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cases="$here/cases-golden-words.jsonl"
runs="${RUNS:-3}"
judge="${JUDGE:-opus}"
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
[ -f "$cases" ] || { echo "missing $cases" >&2; exit 2; }

empty="$(mktemp -d)"
# Safe mode drops ~/.claude/CLAUDE.md; strict MCP config keeps the memory store out.
reader() { # model prompt
  (cd "$empty" && printf '%s' "$2" | claude -p --model "$1" --safe-mode --strict-mcp-config \
    --no-session-persistence --tools "" 2>/dev/null)
}

grade() { # rules-json output -> JSON {"kept":[bool,...]}
  local prompt="You grade one text against a numbered rule list. For each rule answer true when the text follows it and false when it breaks it or ignores it where it applies.

RULES (JSON array, in order):
$1

TEXT:
$2

Reply with one line of JSON and nothing else: {\"kept\":[true,false,...]} with one entry per rule, in order."
  (cd "$empty" && claude -p --model "$judge" --safe-mode --strict-mcp-config \
    --no-session-persistence --tools "" "$prompt" 2>/dev/null) | grep -o '{.*}' | tail -1
}

failed=0; total=0

while IFS= read -r line; do
  [ -n "$line" ] || continue
  id="$(jq -r .id <<<"$line")"
  [ -z "$only" ] || [ "$only" = "$id" ] || continue

  word="$(jq -r .word <<<"$line")"
  tier="${TIER:-$(jq -r .tier <<<"$line")}"
  task="$(jq -r .task <<<"$line")"
  rules_json="$(jq -c .rules <<<"$line")"
  rules_text="$(jq -r '.rules | to_entries | map("\(.key + 1). \(.value)") | join(" ")' <<<"$line")"
  n_rules="$(jq '.rules | length' <<<"$line")"

  declare -a kept_word kept_noword
  for ((r = 0; r < n_rules; r++)); do kept_word[$r]=0; kept_noword[$r]=0; done

  for arm in word noword; do
    case "$arm" in
      word)   prompt="$task

Write it as $word. Print only the result." ;;
      noword) prompt="$task

Rules: $rules_text Print only the result." ;;
    esac
    for ((i = 1; i <= runs; i++)); do
      out="$(reader "$tier" "$prompt")"
      verdict="$(grade "$rules_json" "$out")"
      [ "$verbose" -eq 1 ] && printf '  %s %s run %d: %s\n' "$id" "$arm" "$i" "$verdict"
      for ((r = 0; r < n_rules; r++)); do
        k="$(jq -r ".kept[$r] // false" <<<"$verdict" 2>/dev/null || echo false)"
        if [ "$k" = "true" ]; then
          if [ "$arm" = word ]; then kept_word[$r]=$((kept_word[$r] + 1)); else kept_noword[$r]=$((kept_noword[$r] + 1)); fi
        fi
      done
    done
  done

  total=$((total + 1))
  case_pass=1
  printf '%s  word=%s  tier=%s\n' "$id" "$word" "$tier"
  for ((r = 0; r < n_rules; r++)); do
    rule="$(jq -r ".rules[$r]" <<<"$line")"
    mark=ok
    [ "${kept_word[$r]}" -eq "$runs" ] || { mark=BROKEN; case_pass=0; }
    printf '  %-6s word %d/%d  no-word %d/%d  %s\n' "$mark" "${kept_word[$r]}" "$runs" "${kept_noword[$r]}" "$runs" "$rule"
  done
  if [ "$case_pass" -eq 1 ]; then echo "  PASS"; else echo "  FAIL"; failed=$((failed + 1)); fi
  unset kept_word kept_noword
done < "$cases"

[ "$total" -gt 0 ] || { echo "no cases ran" >&2; exit 2; }
printf '\n%d/%d words pass\n' "$((total - failed))" "$total"
[ "$failed" -eq 0 ]
