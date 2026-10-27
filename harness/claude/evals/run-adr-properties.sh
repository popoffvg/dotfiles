#!/usr/bin/env bash
# Grade the ADR Property rules in domain-modeling/ADR-FORMAT.md § Properties.
#
# Two suites:
#   classify — the model reads one candidate line and says "property" or "reject", and gives
#              the [keep] or [new] mark. Gold labels come from the user's corrections.
#   write    — the model writes a whole `## Properties` section for one decision. A script checks
#              the format, the evidence words, the order, and the coverage; a judge that does not
#              see the skill tries to state each line as a Lean theorem over the black box.
#
# Usage:
#   ./run-adr-properties.sh                  # both suites
#   ./run-adr-properties.sh -s classify      # one suite
#   ./run-adr-properties.sh -i <case-id>     # one case
#   ./run-adr-properties.sh -v               # print the model's reason or its section
# Env:
#   MODEL=sonnet          # model passed to `claude -p`
#   SKILL_REV=<rev>       # grade ADR-FORMAT.md at this git revision (default: working tree)
#   JOBS=6                # calls in parallel
#   THRESHOLD=0.9         # minimum classify accuracy to exit 0
#   NOCACHE=1             # force new calls
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(git -C "$here" rev-parse --show-toplevel)" || exit 2
format_path="harness/claude/skills/domain-modeling/ADR-FORMAT.md"
model="${MODEL:-sonnet}"
jobs_max="${JOBS:-6}"
threshold="${THRESHOLD:-0.9}"
cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/adr-properties-evals"
suite=""; only=""; verbose=0

while getopts "s:i:v" opt; do
  case "$opt" in
    s) suite="$OPTARG" ;;
    i) only="$OPTARG" ;;
    v) verbose=1 ;;
    *) exit 2 ;;
  esac
done

for dep in claude jq git python3; do
  command -v "$dep" >/dev/null || { echo "adr-properties-eval: missing dependency: $dep" >&2; exit 2; }
done

format_text() {
  if [ -n "${SKILL_REV:-}" ]; then git -C "$root" show "$SKILL_REV:$format_path"; else cat "$root/$format_path"; fi
}

rules="$(format_text | awk '/^### Properties$/{on=1} on && /^### Optional sections$/{exit} on')"
[ -n "$rules" ] || { echo "adr-properties-eval: no § Properties in $format_path at ${SKILL_REV:-worktree}" >&2; exit 2; }
label="ADR-FORMAT@${SKILL_REV:-worktree}"

# Neutral cwd, project-only settings, no tools: the model answers from the prompt alone.
ask_model() {
  local key file reply
  key="$(printf '%s\n%s' "$model" "$1" | shasum -a 256 | cut -c1-32)"
  file="$cache_dir/$key"
  if [ -z "${NOCACHE:-}" ] && [ -s "$file" ]; then cat "$file"; return; fi
  reply="$(cd "${TMPDIR:-/tmp}" && printf '%s' "$1" | claude -p --model "$model" \
    --setting-sources project --strict-mcp-config --disable-slash-commands --tools "" 2>/dev/null)"
  if [ -n "$reply" ]; then mkdir -p "$cache_dir" && printf '%s\n' "$reply" > "$file"; fi
  printf '%s\n' "$reply"
}

throttle() { while [ "$(jobs -rp | wc -l)" -ge "$jobs_max" ]; do sleep 0.5; done; }

# The judge sees the written lines and the Lean test, never the skill text, so it grades the
# result and not the wording of the rules.
judge_lines() {
  local props verdicts
  props="$(grep '^- P' "$1")"
  [ -n "$props" ] || return 0
  verdicts="$(ask_model "Label each line below. Model the system as only what a caller, a user, or an operator sees: the calls, their results, the stored data, the requests the system sends to outside services, the time, and the resources. Try to state the line as a theorem in Lean over that model.

Anchors from the user:
rule: \"A huge file uploads in parallel.\" (the outside requests overlap in time)
rule: \"Every upload can be cancelled.\"
rule: \"A stored object holds exactly the bytes the writer sent.\"
rule: \"With a cloud storage, an interrupted upload resumes also after a server restart.\" (the user picks the storage, so it is visible)
detail: \"A missing name gives an error that matches fs.ErrNotExist.\"
detail: \"The FS store writes a temp file and renames it at Close.\"

rule   = you can state it over that model.
detail = the statement needs a component, a protocol step, a format, an algorithm, a library, a file, or an error value from inside the system, or the line is too vague to state.

$props

Reply with JSON lines only, one per input line, in order:
{\"line\":\"P<n>\",\"label\":\"rule|detail\",\"lean\":\"<the theorem statement in one line, or none>\",\"why\":\"<10 words>\"}" | grep -o '{.*}')"
  jq -r 'select(.label == "detail") | "implementation detail: \(.line) — \(.why)"' <<<"$verdicts" 2>/dev/null
}

out="$(mktemp -d)"; trap 'rm -rf "$out"' EXIT
status=0

run_classify() {
  local cases="$here/cases-adr-properties.jsonl" n=0 line id
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    id="$(jq -r .id <<<"$line")"
    [ -z "$only" ] || [ "$only" = "$id" ] || continue
    n=$((n + 1)); printf '%s\n' "$line" > "$out/c$n.case"
    (
      prompt="You write the Properties of an ADR. Apply these rules literally.

$rules

--- DECISION ---
$(jq -r .context <<<"$line")
--- END DECISION ---

A draft lists this line under ## Properties:
$(jq -r .line <<<"$line")

Does the line belong under ## Properties as it is written? Ignore only a missing [keep] or [new] mark.
If it belongs, give the mark it should carry.
Reply with one line of JSON and nothing else:
{\"verdict\":\"property|reject\",\"mark\":\"keep|new|-\",\"why\":\"<12 words>\"}"
      ask_model "$prompt" | grep -o '{.*}' | tail -1 > "$out/c$n.json"
    ) &
    throttle
  done < "$cases"
  wait

  local pass=0 total=0 i want got wmark gmark why verdict
  for i in $(seq 1 "$n"); do
    line="$(cat "$out/c$i.case")"; id="$(jq -r .id <<<"$line")"
    want="$(jq -r .verdict <<<"$line")"; wmark="$(jq -r .mark <<<"$line")"
    got="$(jq -r '.verdict // "?"' "$out/c$i.json" 2>/dev/null || echo '?')"
    gmark="$(jq -r '.mark // "?"' "$out/c$i.json" 2>/dev/null || echo '?')"
    why="$(jq -r '.why // ""' "$out/c$i.json" 2>/dev/null || echo '')"
    total=$((total + 1))
    if [ "$got" = "$want" ] && { [ "$want" = reject ] || [ "$gmark" = "$wmark" ]; }; then
      verdict=PASS; pass=$((pass + 1))
    else
      verdict=FAIL
    fi
    printf '%s want=%-8s got=%-8s mark=%s/%s  %-14s %s\n' "$verdict" "$want" "$got" "$wmark" "$gmark" "$(jq -r .pain <<<"$line")" "$id"
    [ "$verbose" -eq 1 ] && [ -n "$why" ] && printf '     ↳ %s\n' "$why"
  done
  [ "$total" -gt 0 ] || return 0
  local acc; acc="$(awk -v p="$pass" -v t="$total" 'BEGIN{printf "%.2f", p/t}')"
  printf '\nclassify %s: %d/%d  accuracy %s (threshold %s)\n\n' "$label" "$pass" "$total" "$acc" "$threshold"
  awk -v a="$acc" -v t="$threshold" 'BEGIN{exit !(a+0 >= t+0)}' || status=1
}

run_write() {
  local cases="$here/cases-adr-properties-write.jsonl" n=0 line id
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    id="$(jq -r .id <<<"$line")"
    [ -z "$only" ] || [ "$only" = "$id" ] || continue
    n=$((n + 1)); printf '%s\n' "$line" > "$out/w$n.case"
    (
      prompt="You write the Properties of an ADR. Apply these rules literally.

$rules

--- DECISION ---
$(jq -r .context <<<"$line")
--- END DECISION ---

Write the ## Properties section of this ADR and nothing else."
      ask_model "$prompt" > "$out/w$n.md"
    ) &
    throttle
  done < "$cases"
  wait

  local pass=0 total=0 i report
  for i in $(seq 1 "$n"); do
    line="$(cat "$out/w$i.case")"; id="$(jq -r .id <<<"$line")"
    report="$(python3 -I "$here/check-adr-properties.py" "$out/w$i.md" "$(jq -c .must <<<"$line")")"
    report="$(printf '%s\n%s\n' "$report" "$(judge_lines "$out/w$i.md")" | sed '/^$/d')"
    total=$((total + 1))
    if [ -z "$report" ]; then printf 'PASS %s\n' "$id"; pass=$((pass + 1))
    else printf 'FAIL %s\n%s\n' "$id" "$(sed 's/^/     ↳ /' <<<"$report")"; status=1; fi
    [ "$verbose" -eq 1 ] && sed 's/^/     | /' "$out/w$i.md"
  done
  [ "$total" -gt 0 ] && printf '\nwrite %s: %d/%d sections clean\n' "$label" "$pass" "$total"
}

[ -z "$suite" ] || [ "$suite" = classify ] && run_classify
[ -z "$suite" ] || [ "$suite" = write ] && run_write
exit "$status"
