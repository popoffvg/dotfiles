#!/usr/bin/env bash
# SessionEnd: find the ADR files this session wrote or edited, and start a detached headless
# claude that archives each ADR recording a tactical or implementation decision.
# A SessionEnd hook cannot start a subagent in the ending session, so the check runs as `claude -p`.
# WM_ADR_TACTICAL_CHECK=1 marks the child session; its own SessionEnd must not start another check.
set -euo pipefail

[[ "${WM_ADR_TACTICAL_CHECK:-}" == 1 ]] && exit 0

INPUT=$(cat)
TRANSCRIPT=$(jq -r '.transcript_path // ""' <<<"$INPUT" 2>/dev/null) || exit 0
CWD=$(jq -r '.cwd // ""' <<<"$INPUT" 2>/dev/null) || exit 0
SESSION=$(jq -r '.session_id // "unknown"' <<<"$INPUT" 2>/dev/null) || exit 0
[[ -f "$TRANSCRIPT" && -d "$CWD" ]] || exit 0

ADR_PATH_RE='[^ "'"'"'`]*/adr/[0-9]{4}-[^ "'"'"'`/]*\.md'

paths=$(
  jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use")
         | if (.name=="Write" or .name=="Edit" or .name=="MultiEdit") then .input.file_path // empty
           elif .name=="Bash" then .input.command // empty
           else empty end' "$TRANSCRIPT" 2>/dev/null \
    | grep -oE "$ADR_PATH_RE" | sort -u
) || exit 0

adrs=()
while IFS= read -r p; do
  [[ -n "$p" ]] || continue
  [[ "$p" == /* ]] || p="$CWD/$p"
  [[ "$p" == */archived/* || "$p" == *'/!archived/'* ]] && continue
  [[ -f "$p" ]] && adrs+=("$p")
done <<<"$paths"
((${#adrs[@]})) || exit 0

archive_dir() {
  local adr_dir
  adr_dir=$(dirname "$1")
  case "$adr_dir" in
    */docs/adr) printf '%s\n' "${adr_dir%/adr}/!archived/adr" ;;
    *) printf '%s\n' "$adr_dir/archived" ;;
  esac
}

list=""
add_dirs=()
for f in "${adrs[@]}"; do
  list="${list}- ${f} → archive folder: $(archive_dir "$f")/"$'\n'
  add_dirs+=(--add-dir "$(dirname "$(dirname "$f")")")
done

TODAY=$(date +%F)
PROMPT="You check ADR files that a finished session wrote or edited. Edit only these files and their archive folders.

${list}
Read ~/.claude/skills/adr/SKILL.md, section '2. Keep only the global decisions'. It defines the architecture tests, the feature tests, and the 2b table of homes for a tactical decision.

For each ADR file:
1. Read it. Sort it into a kind, and run the four tests of that kind.
2. If every test passes, keep the file. Change nothing.
3. If a test fails, the ADR records a tactical or implementation decision. Drop it:
   a. Append one line to its '## Changelog' section: '- ${TODAY} — Deprecated: tactical, not global — <the failed test, one clause>; home: <the home from the 2b table>'.
   b. Create the archive folder, and move the file into it with mv. Keep the file name.
   c. If the archive folder already has a file with that name, do not move it. Report it.

Finish with one line per file: '<file name>: kept | dropped (<failed test>) | not moved (<reason>)'."

LOG_DIR="$HOME/.claude/logs/adr-tactical-check"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%Y%m%d-%H%M%S)-${SESSION}.log"

{
  printf 'session: %s\ncwd: %s\nfiles:\n%s\n' "$SESSION" "$CWD" "$list"
} >"$LOG"

(
  cd "$CWD" &&
    WM_ADR_TACTICAL_CHECK=1 nohup claude -p "$PROMPT" \
      --model sonnet \
      --permission-mode acceptEdits \
      --allowedTools Read Edit 'Bash(mv:*)' 'Bash(mkdir:*)' 'Bash(ls:*)' \
      "${add_dirs[@]}" \
      >>"$LOG" 2>&1 </dev/null &
) || true

printf 'wm: ADR tactical check started for %d file(s). Log: %s\n' "${#adrs[@]}" "$LOG" >&2
exit 0
