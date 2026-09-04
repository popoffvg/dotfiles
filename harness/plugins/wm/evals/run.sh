#!/usr/bin/env bash
# Grade the TODO-pair gates from arch:sub-todo.md against labelled cases.
#
# Two axes per case, both decided by the same rules a `todo` author applies:
#   half  — human | agent | corpus : which file this content belongs in — a half of the pair,
#           or the corpus outside it (thoughts/, which holds every rule and every reason)
#   form  — keep   | reshape : does it ship as written, or is it a BODY that must be
#           reshaped into an Interface block + a Behavior sketch (or into case sentences)
#
# The rule text is read live from the skill, so the eval always grades the current spec.
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
skill="$here/../skills/arch/commands/sub-todo.md"
cases="$here/cases-todo.jsonl"
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
[ -f "$skill" ] || { echo "no sub-todo.md at $skill" >&2; exit 2; }
[ -f "$cases" ] || { echo "no cases-todo.jsonl at $cases" >&2; exit 2; }

# The five rule blocks under test, verbatim from the skill. § Surface carries the
# surface-not-a-body rule as a nested #### heading, so extracting to `### Changes` gets both.
pair_rule="$(awk '/^## One ledger row, two halves$/{p=1} /^## Precondition/{p=0} p' "$skill")"
surface_rule="$(awk '/^### Surface$/{p=1} /^### Changes$/{p=0} p' "$skill")"
changes_rule="$(awk '/^### Changes$/{p=1} /^### Autotest$/{p=0} p' "$skill")"
autotest_rule="$(awk '/^### Autotest$/{p=1} /^### Commit$/{p=0} p' "$skill")"
rules_rule="$(awk '/^### Constraints$/{p=1} /^### Components$/{p=0} p' "$skill")"

[ -n "$pair_rule" ]     || { echo "could not extract § One ledger row, two halves from $skill" >&2; exit 2; }
[ -n "$surface_rule" ]  || { echo "could not extract § Surface from $skill" >&2; exit 2; }
[ -n "$changes_rule" ]  || { echo "could not extract § Changes from $skill" >&2; exit 2; }
[ -n "$autotest_rule" ] || { echo "could not extract § Autotest from $skill" >&2; exit 2; }
[ -n "$rules_rule" ]    || { echo "could not extract § Constraints from $skill" >&2; exit 2; }

pass=0; fail=0; half_ok=0; form_ok=0; total=0

while IFS= read -r line; do
  [ -n "$line" ] || continue
  id="$(jq -r .id <<<"$line")"
  [ -z "$only" ] || [ "$only" = "$id" ] || continue

  intent="$(jq -r .intent <<<"$line")"
  candidate="$(jq -r .candidate <<<"$line")"
  want_half="$(jq -r .half <<<"$line")"
  want_form="$(jq -r .form <<<"$line")"

  prompt="You are authoring a wm TODO. One ledger row compiles to a PAIR of files, and the rules that
pair obeys live outside it in the corpus. Every block of content has exactly one correct home and one
correct form. Apply the rules below literally.

$pair_rule

$surface_rule

$changes_rule

$autotest_rule

$rules_rule

--- CANDIDATE ---
The author wants to put this into the TODO. What they say it is: $intent

$candidate
--- END CANDIDATE ---

Answer two questions about this candidate.

1. \"half\": which file does this content belong in?
   \"human\" = TODO-N.md (Outcome, New terms, Components, Surface, Autotest, Commit).
             Surface is the ONE diff in the pair, so any fenced diff, or a file-contract
             block for a file that has no surface, is human.
   \"agent\" = TODO-N.agent.md (the Constraints pointer, Changes, Files, Pre-reads, Manual test, Definition of
             done). Changes holds the increments as Files + Surface + Do + Blast radius prose, and
             carries no diff at all. Constraints is one fixed line — \"Obey every rule that
             ~/.claude/scripts/wm-constraints.py <notes-dir>/thoughts prints.\" — never a rule.
   \"corpus\" = outside the pair, in thoughts/. A settled rule an increment can violate is a
             decision note whose description IS the rule text; a REASON — why a choice was made,
             what lost, what a reviewer would argue with — is the rest of that same note. No file
             under todos/ ever carries a rule table or an origin link.

2. \"form\": does it ship as written, or must it be reshaped?
   \"keep\"    = it is already the right form for its section: a changed surface as a diff, a
                file-contract block, a Behavior sketch, a Do bullet in prose, a table, or case
                sentences. Also \"keep\" for a body that carries a **Body requested:** bullet —
                that marker records the human asking for it, which is the one thing that makes a
                body legal.
   \"reshape\" = it is a BODY — content that IS the implementation (a function body, loop,
                branch chain, shell script, SQL, regex, fixture, literal expected-value
                table, or test-file assertions). It must be replaced by an Interface block
                plus a Behavior sketch, or by case sentences.

Judge the candidate as offered. \"reshape\" is about the content being a body, not about it
being long or badly written. Values that a caller can see — enum members, config defaults,
struct fields, interface methods, exit codes — are surface, not bodies.

Reply with one line of JSON and nothing else:
{\"half\":\"human|agent|corpus\",\"form\":\"keep|reshape\",\"why\":\"<12 words>\"}"

  # Neutral cwd + no user settings: the graded model must not inherit this machine's
  # hooks, plugins, skills, or MCP servers.
  # --disable-slash-commands: keep the judge blind to the installed wm skills, so it
  # answers from the rule text in the prompt rather than from a cached reading of it.
  raw="$(cd "${TMPDIR:-/tmp}" && claude -p --model "$model" \
    --setting-sources project --strict-mcp-config \
    --disable-slash-commands "$prompt" 2>/dev/null)"
  got="$(grep -o '{.*}' <<<"$raw" | tail -1)"
  got_half="$(jq -r '.half // "?"' <<<"$got" 2>/dev/null || echo '?')"
  got_form="$(jq -r '.form // "?"' <<<"$got" 2>/dev/null || echo '?')"
  why="$(jq -r '.why // ""' <<<"$got" 2>/dev/null || echo '')"

  total=$((total + 1))
  h="✗"; f="✗"
  [ "$got_half" = "$want_half" ] && { h="✓"; half_ok=$((half_ok + 1)); }
  [ "$got_form" = "$want_form" ] && { f="✓"; form_ok=$((form_ok + 1)); }
  if [ "$h$f" = "✓✓" ]; then
    joint=PASS; pass=$((pass + 1))
  else
    joint=FAIL; fail=$((fail + 1))
  fi

  printf '%s half[%s] want=%-6s got=%-6s | form[%s] want=%-8s got=%-8s  %s\n' \
    "$joint" "$h" "$want_half" "$got_half" "$f" "$want_form" "$got_form" "$id"
  [ "$verbose" -eq 1 ] && [ -n "$why" ] && printf '     ↳ %s\n' "$why"
done < "$cases"

[ "$total" -gt 0 ] || { echo "no cases ran" >&2; exit 2; }

acc="$(awk -v p="$pass" -v t="$total" 'BEGIN{printf "%.2f", p/t}')"
printf '\n%d/%d joint  |  half %d/%d  |  form %d/%d  |  accuracy %s (threshold %s)\n' \
  "$pass" "$total" "$half_ok" "$total" "$form_ok" "$total" "$acc" "$threshold"

awk -v a="$acc" -v t="$threshold" 'BEGIN{exit !(a+0 >= t+0)}'
