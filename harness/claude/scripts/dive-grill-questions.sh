#!/usr/bin/env bash
# Generate per-entry-point research question lists for the `/dive docs` route.
#
# For each `slug=entry-point-description` argument, runs `claude --model haiku
# --print` with the grill-me agenda prompt and writes
# $RESEARCH_DIR/<slug>.questions.md. Runs all entry points in parallel.
#
# Usage:
#   RESEARCH_DIR=/abs/path TASK_CONTEXT="one-line task" \
#     dive-grill-questions.sh 'slug=Entry point description' 'slug2=...'
#
# Env:
#   RESEARCH_DIR   required, absolute output dir (created if missing)
#   TASK_CONTEXT   required, one-line task description passed to every prompt
#   MODEL          optional, default haiku
#   FORCE          optional, 1 = regenerate files that already exist
set -euo pipefail

: "${RESEARCH_DIR:?RESEARCH_DIR is required}"
: "${TASK_CONTEXT:?TASK_CONTEXT is required}"
MODEL="${MODEL:-haiku}"
FORCE="${FORCE:-0}"
MIN_BYTES="${MIN_BYTES:-800}"
REQUIRED_MARKER="${REQUIRED_MARKER:-## Intent}"

if [ "$#" -eq 0 ]; then
  echo "usage: RESEARCH_DIR=... TASK_CONTEXT=... $0 'slug=entry point' ..." >&2
  exit 2
fi

mkdir -p "$RESEARCH_DIR"

build_prompt() {
  local ep="$1"
  cat <<PROMPT
/grill-me

You are NOT interviewing a human. You are grilling the codebase entry point below to generate a research agenda for another agent (the "explorer") that will read the code and answer your questions.

Entry point: ${ep}
Task context: ${TASK_CONTEXT}

The explorer will use your questions to populate a refactor-oriented artifact graded against a 6-step chain: entry point -> tests -> follow data -> skip noise -> failure path -> one-sentence trace. Bias your questions so the explorer is forced to satisfy every step.

Produce a markdown file with sections:

## Intent / test questions (tests-first)
- Which tests exercise this path, and what intent does each pin (the behaviour the code must keep)?
- Is any part of the path UNTESTED? Which branch has no test?
- Do the tests reveal intent the implementation hides (edge cases asserted, error messages pinned)?

## Workflow-step questions
- What are the ordered atomic steps from entry to exit on the happy path?
- For each step, what is the exact file:line and what state does it touch?

## Decision-point questions
- What every if/switch/dispatch table branches on; what fields it checks; what each branch does differently.
- Where the code forks into parallel paths (prerun/main, sync/async, fast-path/slow-path) and what carries identity across the fork.

## Edge-case questions (adversarial)
- Empty inputs, single-element inputs, duplicate keys, key collisions.
- Race conditions, iteration-order non-determinism, concurrent mutation.
- Partial failure mid-loop: what state has already been mutated and is there a rollback?
- Deleted/missing referenced resources, stale caches, encoder ambiguity (same input -> different serialisation?).
- Silent overwrites, silent drops (continue on missing field), asymmetric branches across similar handlers.

## Identity & invariant questions
- What is "identity" at each layer (handle string, resource ID, hash, axis key, ...) and how is equality defined?
- Which fields are mutable vs locked-after-creation? Which are part of dedup keys vs annotations?

## Refactor-hotspot questions
- Which surfaces couple multiple files (schema + dispatcher + handler)?
- Which contracts are implicit (cache key formula, iteration order, name canonicalisation)?
- Where would a future change most likely cause silent data loss or stale cache?

## Surprises / gotchas
- What would a new contributor most likely get wrong?

Each question must be answerable by reading the code. Be specific and adversarial - assume the code has hidden complexity. No questions for humans.
PROMPT
}

pids=()
for arg in "$@"; do
  slug="${arg%%=*}"
  ep="${arg#*=}"
  out="$RESEARCH_DIR/$slug.questions.md"

  if [ -s "$out" ] && [ "$FORCE" != "1" ]; then
    echo "skip   $out (exists; FORCE=1 to regenerate)"
    continue
  fi

  (
    if ! build_prompt "$ep" | claude --model "$MODEL" --print --output-format text >"$out.part" 2>"$out.err"; then
      echo "FAILED $out (claude exited non-zero; see $out.err)" >&2
      exit 1
    fi
    # claude can exit 0 having printed nothing or a stub. An empty agenda is a
    # silent failure: the explorer gets no questions and its verification trail
    # is gone. Treat anything under MIN_BYTES as a failure, keep the .part for
    # inspection.
    size=$(wc -c <"$out.part" | tr -d ' ')
    if [ "$size" -lt "$MIN_BYTES" ]; then
      echo "FAILED $out (only ${size}B, need >= ${MIN_BYTES}B; kept $out.part)" >&2
      exit 1
    fi
    # Size alone does not prove it is an agenda: a hijacked child session can
    # emit a long, on-topic-looking transcript. Require the structural marker.
    if ! grep -q "$REQUIRED_MARKER" "$out.part"; then
      echo "FAILED $out (${size}B but marker '$REQUIRED_MARKER' missing — likely hook/transcript output; kept $out.part)" >&2
      exit 1
    fi
    mv "$out.part" "$out"
    rm -f "$out.err"
    echo "ok     $out (${size}B)"
  ) &
  pids+=("$!")
done

rc=0
for pid in "${pids[@]:-}"; do
  wait "$pid" || rc=1
done
exit "$rc"
