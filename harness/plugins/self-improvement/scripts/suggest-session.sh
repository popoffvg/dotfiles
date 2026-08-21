#!/usr/bin/env bash
# Propose where one kept session's lesson belongs in the harness as it stands.
# `suggest-session.sh <session-id>`
#
# The second half of a scan: scoring says *whether* a session holds a lesson,
# this says *what to do about it* — extend which skill, or none, because
# something already covers it. Runs only for a session that scored at or above
# the keep threshold, on the stronger model, and writes exactly one file:
# suggestions/<session-id>.md. Nothing in this plugin edits a skill or a doc.
#
# The pass is given three things and nothing else: the prompts the person typed,
# the score the earlier pass produced, and an inventory of every skill trigger
# and doc that already exists. That inventory is what makes "already covered" a
# possible answer, and on a harness of 90+ skills it is the answer that keeps the
# corpus from growing a near-duplicate every week.
#
# The rubric and the output shape are not restated here:
# `references/suggest.md` is read into the prompt verbatim.
set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

if [ $# -ne 1 ]; then
  printf 'usage: %s <session-id>\n' "$(basename "$0")" >&2
  exit 2
fi

id=$1
record=$(record_path "$id")
[ -f "$record" ] || { printf 'no record for %s\n' "$id" >&2; exit 1; }

transcript=$(record_get "$id" transcript '')
score=$(record_get "$id" score 0)
scope=$(record_get "$id" scope none)
why=$(record_get "$id" why '')
archive=$(record_get "$id" archive '')

# The archive is the fallback source, not just a copy for /dream: a kept session
# outlives its transcript, and the suggestion has to still be possible afterwards.
# That is the whole reason the transcript was copied out at scoring time.
source_transcript=$transcript
if [ ! -f "$source_transcript" ]; then
  if [ -n "$archive" ] && [ -f "$archive" ]; then
    source_transcript=$archive
  else
    log "suggest $id: no transcript and no archive"
    exit 0
  fi
fi

rubric="$plugin_root/skills/capture-lesson/references/suggest.md"

# Which repos to offer as project-scope targets. They come from the archive's
# .env.md sidecar rather than from the cwd: the sidecar was written while the
# session was alive and is the only record of the repos that were in context
# after those directories have moved or gone.
repos=()
if [ -n "$archive" ] && [ -f "$archive.env.md" ]; then
  while IFS= read -r repo; do
    [ -d "$repo" ] && repos+=("$repo")
  done < <(sed -n 's/^| `\([^`]*\)`.*/\1/p' "$archive.env.md")
fi

inventory=$("$scripts_dir/harness-inventory.sh" ${repos[@]+"${repos[@]}"} 2>/dev/null || printf '')
prompts=$("$scripts_dir/human-turns.sh" "$source_transcript" 0 2>/dev/null | strip_reader_marks \
  | tail -c "${SELF_IMPROVE_PROMPT_BYTES:-40000}" || printf '')

if [ -z "$prompts" ]; then
  log "suggest $id: no human prompts"
  exit 0
fi

read -r -d '' request <<EOF || true
$(cat "$rubric")

---

## This session's score

score $score / 10, scope $scope — $why

## The harness as it exists today

One row per skill or doc: scope, path, name, trigger. \`[auto]\` marks a skill
this plugin wrote itself.

$inventory

## The prompts the person typed

$prompts
EOF

export SELF_IMPROVE_CHILD=1

mkdir -p "$suggestions_dir"
dest=$(suggestion_path "$id")

# Read/Grep/Glob and nothing else: the pass may open the one or two candidate
# skills it names, and has no tool that could write to the harness even if it
# decided to.
if ! printf '%s' "$request" | claude -p \
  --model "$suggest_model" \
  --allowedTools Read Grep Glob \
  --disallowedTools Edit Write MultiEdit Bash Task WebFetch WebSearch \
  > "$dest.tmp.$$" 2>/dev/null; then
  rm -f "$dest.tmp.$$"
  log "suggest $id: model call failed"
  exit 1
fi
mv "$dest.tmp.$$" "$dest"

verdict=$(sed -n 's/^- \*\*Verdict:\*\* *//p' "$dest" | head -n 1 | tr -d ' ')
# The path often arrives fenced in backticks, because the document is markdown
# and a path reads better that way. The record holds the path itself.
target=$(sed -n 's/^- \*\*Target:\*\* *//p' "$dest" | head -n 1 | tr -d '`')

# A malformed document is still recorded, and the record still points at it. The
# alternative — leaving the field empty — makes every later scan try this session
# again, which is a retry loop with a model call in it. The user regenerates one
# from the TUI when they want to.
case "$verdict" in
  covered|extend|doc|new-skill) ;;
  *) verdict=unparsed ;;
esac

old=$(cat "$record")
record_write "$id" "$(jq -n --argjson old "$old" \
  --arg path "$dest" --arg verdict "$verdict" --arg target "$target" \
  --arg at "$(date -u +%FT%TZ)" '
  $old + {suggestion: $path, suggestion_verdict: $verdict,
          suggestion_target: $target, suggested_at: $at}')"

log "suggest $id: verdict=$verdict target=${target:-none}"

case "$verdict" in
  extend|doc|new-skill)
    "$scripts_dir/notify.sh" "Harness suggestion ($verdict)" "${target:-$id}"
    ;;
esac
