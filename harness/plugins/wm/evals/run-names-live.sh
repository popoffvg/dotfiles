#!/usr/bin/env bash
# Grade whether the naming skills actually FIRE in a real session.
#
# The companion suite (run-names.sh) pastes both descriptions into the prompt and asks a judge to
# pick one. That grades whether the two descriptions SEPARATE. It cannot grade whether either one
# fires, because it hands the model the answers and forces a choice.
#
# This runner asks nothing. It starts a real `claude -p` session on the task text, with the whole
# machine's skill set installed and competing, and reads the transcript for a Skill tool call.
# Nobody tells the session a naming skill exists.
#
#   fired — searchable-names | pedant | none : which skill the session actually loaded
#
# A `none` gold label passes when the session loads NEITHER naming skill; loading some unrelated
# skill is not a failure, since real sessions do that all the time.
#
# Usage:
#   ./run-names-live.sh                 # all cases
#   ./run-names-live.sh -i <case-id>    # one case
#   ./run-names-live.sh -v              # print every Skill call each session made
# Env:
#   MODEL=sonnet                        # model passed to `claude -p` (default: sonnet)
#   THRESHOLD=0.7                       # minimum accuracy to exit 0 (default: 0.7)
#   REPEATS=3                           # sessions per case; a case passes if ANY of them fires
#                                       # the wanted skill (default: 3)
#
# The threshold is lower than the description suite's on purpose. This measures a real decision
# under real competition, and a skill that fires on 7 of 10 genuine cases is doing its job.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$here/.."
cases="$here/cases-searchable-names.jsonl"
model="${MODEL:-sonnet}"
threshold="${THRESHOLD:-0.7}"
repeats="${REPEATS:-3}"
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
[ -f "$cases" ] || { echo "no cases at $cases" >&2; exit 2; }

# A scratch cwd with no code in it: the session must decide from the task text, not from
# files it happens to find. --plugin-dir loads wm from source, so a skill added since the
# last marketplace sync is still under test.
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

# Every Skill call a session made, in order, one per line.
skills_called() {
  jq -r 'select(.type=="assistant") | .message.content[]?
    | select(.type=="tool_use" and .name=="Skill") | .input.skill // empty' "$1" 2>/dev/null \
    | sed 's/^wm://' | paste -sd, -
}

# Run one task as a real session and print the skills it loaded.
#
# NO --disallowedTools. Passing it suppresses skill invocation outright: the bare word
# "pedant" fires wm:pedant without the flag and fires nothing with it. A run carrying that
# flag scores every case `none` and reads exactly like a description that never triggers.
# Safety comes from the empty scratch cwd instead — there is nothing there to damage.
run_task() {
  local task="$1" stream="$2"
  (cd "$workdir" && claude -p --model "$model" --output-format stream-json --verbose \
    --plugin-dir "$plugin_root" "$task" < /dev/null > "$stream" 2>/dev/null)
}

# PREFLIGHT — a positive control, because every gold label here except five is a claim that
# something fired, and a harness that cannot fire answers identically to a dead description.
# The bare word "pedant" is `pedant`'s own stated trigger and the strongest signal available.
# If it does not fire, the instrument is broken and no score below it means anything.
echo "preflight: does any skill fire at all?"
run_task "pedant" "$workdir/preflight.jsonl"
preflight="$(skills_called "$workdir/preflight.jsonl")"
if ! grep -q 'pedant' <<<"$preflight"; then
  echo "ABORT: the control task \"pedant\" loaded no skill (got: ${preflight:-none})." >&2
  echo "Skill invocation is not working in this harness — a score would be meaningless." >&2
  echo "Check for --disallowedTools, a --permission-mode that blocks tools, or a plugin that failed to load." >&2
  exit 3
fi
echo "preflight ok: fired $preflight"
echo

pass=0; fail=0; total=0

while IFS= read -r line; do
  [ -n "$line" ] || continue
  id="$(jq -r .id <<<"$line")"
  [ -z "$only" ] || [ "$only" = "$id" ] || continue

  task="$(jq -r .task <<<"$line")"
  want="$(jq -r .pick <<<"$line")"
  stream="$workdir/$id.jsonl"

  # Firing is not deterministic. The bare word "pedant" — the strongest trigger in the suite —
  # fired in one session and not in the next, same prompt, minutes apart. So each case runs
  # REPEATS times and passes if the wanted skill fires in ANY of them. Scoring one run per case
  # measures the coin, not the description.
  hits=0
  all_seen=""
  for ((r = 1; r <= repeats; r++)); do
    run_task "$task" "$stream.$r"
    seen="$(skills_called "$stream.$r")"
    all_seen="$all_seen[$r ${seen:-none}]"

    run_got=none
    grep -q 'searchable-names' <<<"$seen" && run_got=searchable-names
    grep -q 'pedant'           <<<"$seen" && run_got=pedant
    # Both loaded: the descriptions overlap. Report it rather than let one mask the other.
    if grep -q 'searchable-names' <<<"$seen" && grep -q 'pedant' <<<"$seen"; then
      run_got=both
    fi
    [ "$run_got" = "$want" ] && hits=$((hits + 1))
  done

  # A positive case passes on ANY hit — firing is noisy, and once is proof the trigger reaches.
  # A `none` case passes only on EVERY run. "Stayed quiet once out of three" is not restraint,
  # and scoring it as a pass would hide a description that over-fires two times in three.
  total=$((total + 1))
  if [ "$want" = none ]; then
    [ "$hits" -eq "$repeats" ] && need_met=1 || need_met=0
  else
    [ "$hits" -gt 0 ] && need_met=1 || need_met=0
  fi

  if [ "$need_met" -eq 1 ]; then
    verdict=PASS; pass=$((pass + 1))
  else
    verdict=FAIL; fail=$((fail + 1))
  fi

  printf '%s want=%-17s hit=%d/%d  %s\n' "$verdict" "$want" "$hits" "$repeats" "$id"
  [ "$verbose" -eq 1 ] && printf '     ↳ %s\n' "$all_seen"
done < "$cases"

[ "$total" -gt 0 ] || { echo "no cases ran" >&2; exit 2; }

acc="$(awk -v p="$pass" -v t="$total" 'BEGIN{printf "%.2f", p/t}')"
printf '\n%d/%d  |  accuracy %s (threshold %s)\n' "$pass" "$total" "$acc" "$threshold"

awk -v a="$acc" -v t="$threshold" 'BEGIN{exit !(a+0 >= t+0)}'
