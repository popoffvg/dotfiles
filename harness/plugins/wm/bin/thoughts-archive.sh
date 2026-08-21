#!/usr/bin/env bash
# PostToolUse (Edit|Write|Bash): move every thought that stopped being live out
# of the graph into <notes-dir>/thoughts/archived/. The last step of both
# arch:ref-note-format.md § Superseding and § Resolution, done by the harness
# instead of by the model — the model writes the replacement note and marks the
# old one, the move is automatic.
#
# Two kinds of note stop being live, and each has its own marker:
#
#   type: question — archived once `status:` is anything but `open`: `approved`
#     (a decision/fact note now carries the answer) or `declined` (moot). A
#     question is a live thought only while it is open, and dropping it out of
#     `thoughts/` is what clears it from the `wm-open-questions.sh` gate.
#
#   every other type — archived on a non-empty `superseded_by:`, and on that key
#     alone. `status: declined` is not enough: it also sits on a moot question.
#     `deprecated_by:` is read as the same marker — the legacy spelling the `fix`
#     flow wrote before impl:sub-fix.md moved to `superseded_by`.
#
# Registered on Bash too, not just Edit|Write — the frontmatter mark is as often
# a perl/sed one-liner as a tool edit, and the sweep is idempotent, so a note
# marked in an earlier session is archived on the next tool call either way.
#
# Never blocks the tool call. Reports on stdout what moved and what the model
# still owes: the resolution frontmatter, the "Answered/Superseded by" body line,
# and any live note whose wikilink still points at the archived one.
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null) || exit 0
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null) || exit 0

# --- locate the live thoughts dir --------------------------------------------
# From the edited path when it sits under a thoughts/ dir (covers a notes dir
# outside cwd); otherwise walk up from cwd to the nearest .notes/thoughts.
thoughts=""
case "$FILE_PATH" in
  */thoughts/*) thoughts="${FILE_PATH%/thoughts/*}/thoughts" ;;
esac

if [[ -z "$thoughts" && -n "$CWD" && -d "$CWD" ]]; then
  dir="$CWD"
  while :; do
    [[ -d "$dir/.notes/thoughts" ]] && { thoughts="$dir/.notes/thoughts"; break; }
    parent=$(dirname "$dir")
    [[ "$parent" == "$dir" ]] && break   # reached filesystem root
    dir="$parent"
  done
fi

[[ -n "$thoughts" && -d "$thoughts" ]] || exit 0

# One grep over the live notes finds the candidates — a replacement marker, or
# any question note (its status decides). The per-note frontmatter parse below
# runs only on those, so the common case costs a single process.
candidates=$(grep -l -E '^(superseded_by|deprecated_by):[[:space:]]*[^[:space:]]|^type:[[:space:]]*question' "$thoughts"/*.md 2>/dev/null) || exit 0
[[ -n "$candidates" ]] || exit 0

notes_dir=$(dirname "$thoughts")
archived="$thoughts/archived"

# First value of <key> inside the leading `---` frontmatter block of <file>,
# unquoted and trimmed. Empty when the key is absent or the file has no block.
fm_value() {
  local v
  v=$(awk -v key="$2" '
    NR == 1 && $0 != "---" { exit }
    NR > 1 && $0 == "---" { exit }
    NR > 1 && index($0, key ":") == 1 {
      sub("^" key ":[[:space:]]*", "")
      print
      exit
    }' "$1") || return 0
  v=${v%%#*}
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  v=${v#\"}; v=${v%\"}
  v=${v#\'}; v=${v%\'}
  printf '%s' "$v"
}

# Live notes (and spec.md / todos) whose wikilink still points at <stem>.
# A live note must not depend on an archived one — the model repoints them.
linkers() {
  local stem="$1" hits
  hits=$(grep -rlF --include='*.md' "[[${stem}" "$notes_dir" 2>/dev/null | grep -v "/thoughts/archived/") || true
  [[ -z "$hits" ]] && return 0
  echo "$hits" | while IFS= read -r f; do
    [[ -n "$f" ]] && printf '%s ' "${f#"$notes_dir"/}"
  done
}

# The supersede marker, whichever key carries it. Empty when neither is in the
# frontmatter — the grep above also matches the key in a body line.
supersede_marker() {
  local v
  v=$(fm_value "$1" superseded_by)
  [[ -n "$v" ]] || v=$(fm_value "$1" deprecated_by)
  printf '%s' "$v"
}

report=""
while IFS= read -r note; do
  [[ -f "$note" ]] || continue

  type=$(fm_value "$note" type)
  status=$(fm_value "$note" status)
  marker=$(supersede_marker "$note")

  if [[ "$type" == "question" ]]; then
    # Live while open, and while the key is absent — an unset status is open.
    [[ -n "$status" && "$status" != "open" ]] || continue
  else
    [[ -n "$marker" ]] || continue
  fi

  base=$(basename "$note")
  mkdir -p "$archived"
  if [[ -e "$archived/$base" ]]; then
    report="${report}  ! $base — a file of that name is already in archived/; left in the live graph, resolve by hand"$'\n'
    continue
  fi
  mv "$note" "$archived/$base" || continue

  if [[ "$type" == "question" ]]; then
    if [[ -n "$marker" ]]; then
      report="${report}  $base (answered by $marker)"$'\n'
      [[ "$status" == "approved" ]] || \
        report="${report}    ! frontmatter says status: $status — an answered question carries status: approved"$'\n'
    elif [[ "$status" == "declined" ]]; then
      report="${report}  $base (moot — no answer note)"$'\n'
    else
      report="${report}  $base (status: $status)"$'\n'
      report="${report}    ! no \`superseded_by:\` — name the note that answers it, or use status: declined for a moot question"$'\n'
    fi
  else
    report="${report}  $base (superseded by $marker)"$'\n'
    [[ "$status" == "declined" ]] || \
      report="${report}    ! frontmatter says status: ${status:-<none>} — a superseded note carries status: declined"$'\n'
  fi

  # The forward pointer to what replaced it: `Answered by` on a question,
  # `Superseded by` on every other type. A moot question has neither.
  if [[ -n "$marker" ]]; then
    verb="Superseded"
    [[ "$type" == "question" ]] && verb="Answered"
    grep -qE '^(Answered|Superseded) by \[\[' "$archived/$base" || \
      report="${report}    ! body is missing its first line \`$verb by [[$marker-<type>-<slug>]]\`"$'\n'
  fi

  still=$(linkers "${base%.md}")
  [[ -z "$still" ]] || \
    report="${report}    ! still linked from: ${still% } — repoint each at the note that replaced it"$'\n'
done <<<"$candidates"

[[ -n "$report" ]] || exit 0

printf 'wm: resolved thoughts archived → %s/\n%s' "${archived#"$notes_dir"/}" "$report"
exit 0
