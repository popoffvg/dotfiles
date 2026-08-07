#!/usr/bin/env bash
# Spec-work focus brief: where the work stands now and the one next step.
#
# Registered on two events (same output, two moments):
#   PreCompact  — emitted while the pre-compaction context is still whole.
#   SessionStart(matcher: compact) — the documented context-injection point, so
#     the brief survives into the compacted session. PreCompact stdout handling
#     is unspecified by the hook contract; this second registration is what
#     guarantees the model reads the brief after a compaction.
#
# Silent unless spec work is detected: a `.notes` dir (cwd or any parent) that
# holds spec.md. Reads only frontmatter `status:` — the two state machines in
# skills/code/references/ref-write.md § Status (spec phase, TODO lifecycle).
set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null) || exit 0
[[ -n "$CWD" && -d "$CWD" ]] || exit 0

# Walk up from <dir> to the nearest existing .notes; echo its path or nothing.
resolve_notes() {
  local dir="$1" parent
  while :; do
    [[ -d "$dir/.notes" ]] && { printf '%s' "$dir/.notes"; return 0; }
    parent=$(dirname "$dir")
    [[ "$parent" == "$dir" ]] && return 1
    dir="$parent"
  done
}

# First `status:` value inside the leading `---` frontmatter block of <file>.
fm_status() {
  awk 'NR==1 && $0!="---"{exit}
       NR>1 && $0=="---"{exit}
       NR>1 && /^status:/{sub(/^status:[[:space:]]*/,""); print $1; exit}' "$1"
}

notes=$(resolve_notes "$CWD") || exit 0
spec="$notes/spec.md"
[[ -f "$spec" ]] || exit 0

phase=$(fm_status "$spec") || true
phase=${phase:-unknown}

# Open question notes block the gate. Reuse the readiness script the `code`
# skill already runs; absent installation degrades to "unknown", never to a lie.
open_count="unknown"
open_ids=""
oq="$HOME/.claude/scripts/wm-open-questions.sh"
if [[ ! -d "$notes/thoughts" ]]; then
  open_count=0 # no thoughts dir means no question notes exist at all
elif [[ -x "$oq" ]]; then
  open_count=$("$oq" "$notes/thoughts" --count 2>/dev/null || true)
  open_count=${open_count:-unknown}
  if [[ "$open_count" != "unknown" && "$open_count" != "0" ]]; then
    open_ids=$("$oq" "$notes/thoughts" --files 2>/dev/null | xargs -n1 basename 2>/dev/null | paste -sd' ' - || true)
  fi
fi

# TODO ledger: count each lifecycle state and remember the first file per state.
declare -A count=() first=()
total=0
if [[ -d "$notes/todos" ]]; then
  while IFS= read -r f; do
    st=$(fm_status "$f") || true
    st=${st:-unknown}
    total=$((total + 1))
    count[$st]=$((${count[$st]:-0} + 1))
    [[ -n "${first[$st]:-}" ]] || first[$st]="$f"
  done < <(find "$notes/todos" -maxdepth 1 -name 'TODO-*.md' -type f | sort -V)
fi

# The TODO to focus on, most-urgent state first.
cur=""
cur_state=""
for st in blocked impl verify todo; do
  if [[ -n "${first[$st]:-}" ]]; then
    cur="${first[$st]}"
    cur_state="$st"
    break
  fi
done

# NEXT: one step, derived from the spec phase and the ledger.
next=""
case "$phase" in
init)
  next="finish research and author spec.md + the ledger — run \`/code new\`. The gate is not reachable yet."
  ;;
review)
  if [[ "$open_count" != "unknown" && "$open_count" != "0" ]]; then
    next="resolve the $open_count open question note(s) — the gate is BLOCKED. Continue the \`/code new\` grill loop; flip each question note in place."
  elif ((total == 0)); then
    next="the spec is at the human gate. Do NOT author TODO bodies unprompted — the human runs \`/code todo\` when satisfied."
  elif [[ -n "$cur_state" ]]; then
    next="TODO bodies exist. Audit the spec with \`/code verify\` before implementing, then \`/code impl\` for $(basename "${cur%.md}")."
  fi
  ;;
impl)
  case "$cur_state" in
  blocked) next="unblock $(basename "${cur%.md}") — a \`depends_on\` TODO is not done, or the review returned FAIL/DEVIATES. Read $cur, then \`/code fix\` or \`/code impl\`." ;;
  impl) next="finish $(basename "${cur%.md}") — it is mid-implementation. Re-read $cur first; start no other TODO until it is done." ;;
  verify) next="run the review gate on $(basename "${cur%.md}") — committed and green, awaiting reviewer/verifier." ;;
  todo) next="implement $(basename "${cur%.md}") — \`/code impl\`. Read its body in full before editing." ;;
  *) next="every TODO is done — close the work with \`/wm:work-finish\`." ;;
  esac
  ;;
*)
  next="spec.md has no readable frontmatter \`status:\` — repair it before continuing (ref-write.md § Status)."
  ;;
esac

# Ledger one-liner, only the states actually present.
ledger=""
for st in done verify impl todo blocked unknown; do
  [[ -n "${count[$st]:-}" ]] && ledger="$ledger ${st}=${count[$st]}"
done

echo "wm SPEC-WORK FOCUS — re-anchor on this before any tool call."
echo "notes: $notes | spec: $spec | PHASE: $phase"
echo "open questions: $open_count${open_ids:+ — $open_ids}"
if ((total > 0)); then
  echo "TODO ledger: $total total —${ledger}"
  [[ -n "$cur" ]] && echo "current TODO: $(basename "${cur%.md}") ($cur_state) — $cur"
else
  echo "TODO ledger: no todos/TODO-N.md bodies yet"
fi
echo "NEXT: $next"
echo "Read the /code skill (wm:code) and the files named above rather than trusting recalled state."
exit 0
