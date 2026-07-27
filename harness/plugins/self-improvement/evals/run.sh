#!/usr/bin/env bash
# Grade capture-lesson's Step 1 (scope) and Step 1b (form) gates against labelled cases.
# The gate text is read live from the skill, so the eval always grades the current spec.
#
# Usage:
#   ./run.sh                 # all cases
#   ./run.sh -i <case-id>    # one case
#   ./run.sh -v              # print the model's rationale per case
# Env:
#   MODEL=sonnet             # model passed to `claude -p` (default: sonnet)
#   THRESHOLD=0.85           # minimum joint accuracy to exit 0 (default: 0.85)
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill="$here/../skills/capture-lesson/SKILL.md"
cases="$here/cases.jsonl"
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
[ -f "$skill" ] || { echo "no SKILL.md at $skill" >&2; exit 2; }
[ -f "$cases" ] || { echo "no cases.jsonl at $cases" >&2; exit 2; }

# Step 1 + Step 1b, verbatim from the skill under test.
gate="$(awk '/^# Step 1 — Pick the scope/{p=1} /^# Step 2 —/{p=0} p' "$skill")"
[ -n "$gate" ] || { echo "could not extract the gate sections from $skill" >&2; exit 2; }

pass=0; fail=0; scope_ok=0; form_ok=0; total=0

while IFS= read -r line; do
  [ -n "$line" ] || continue
  id="$(jq -r .id <<<"$line")"
  [ -z "$only" ] || [ "$only" = "$id" ] || continue

  desc="$(jq -r .description <<<"$line")"
  anchors="$(jq -r .anchors <<<"$line")"
  want_scope="$(jq -r .scope <<<"$line")"
  want_form="$(jq -r .form <<<"$line")"

  prompt="You are applying the two gates below to one captured lesson. Apply them literally.

$gate

--- CASE ---
Lesson trigger: $desc
Evidence in the reproduction: $anchors
--- END CASE ---

Reply with one line of JSON and nothing else:
{\"scope\":\"global|project|skip\",\"form\":\"verdict|check\",\"why\":\"<12 words>\"}
Use \"global\" for a machine-anchored lesson (it is stored at global scope).
Use \"skip\" when the lesson should not become a skill at all; then set form to \"verdict\"."

  # Neutral cwd + no user settings: the graded model must not inherit this
  # machine's hooks, plugins, skills, or MCP servers — the self-improvement Stop
  # hook otherwise answers instead of the model and every case returns empty.
  raw="$(cd "${TMPDIR:-/tmp}" && claude -p --model "$model" \
    --setting-sources project --strict-mcp-config "$prompt" 2>/dev/null)"
  got="$(grep -o '{.*}' <<<"$raw" | tail -1)"
  got_scope="$(jq -r '.scope // "?"' <<<"$got" 2>/dev/null || echo '?')"
  got_form="$(jq -r '.form  // "?"' <<<"$got" 2>/dev/null || echo '?')"
  why="$(jq -r '.why // ""' <<<"$got" 2>/dev/null || echo '')"

  total=$((total + 1))
  s="✗"; f="✗"
  [ "$got_scope" = "$want_scope" ] && { s="✓"; scope_ok=$((scope_ok + 1)); }
  [ "$got_form"  = "$want_form"  ] && { f="✓"; form_ok=$((form_ok + 1)); }
  if [ "$s$f" = "✓✓" ]; then pass=$((pass + 1)); else fail=$((fail + 1)); fi

  printf '%s scope[%s] want=%-7s got=%-7s | form[%s] want=%-7s got=%-7s  %s\n' \
    "$([ "$s$f" = "✓✓" ] && echo PASS || echo FAIL)" \
    "$s" "$want_scope" "$got_scope" "$f" "$want_form" "$got_form" "$id"
  [ "$verbose" -eq 1 ] && [ -n "$why" ] && printf '     ↳ %s\n' "$why"
done < "$cases"

[ "$total" -gt 0 ] || { echo "no cases ran" >&2; exit 2; }

acc="$(awk -v p="$pass" -v t="$total" 'BEGIN{printf "%.2f", p/t}')"
printf '\n%d/%d joint  |  scope %d/%d  |  form %d/%d  |  accuracy %s (threshold %s)\n' \
  "$pass" "$total" "$scope_ok" "$total" "$form_ok" "$total" "$acc" "$threshold"

awk -v a="$acc" -v t="$threshold" 'BEGIN{exit !(a+0 >= t+0)}'
