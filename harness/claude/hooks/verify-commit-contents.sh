#!/usr/bin/env bash
# PostToolUse hook for Bash.
# After a commit, put the commit's real file list into context, and after
# `jj file track`, prove the path is actually tracked.
#
# A commit message is written by the agent, not by the VCS: it proves intent and
# never content. An ignore rule hides a file from the snapshot with no error, so
# a commit can describe a file it does not contain. `jj file track` has the same
# silent failure — it exits 0 and does nothing on an ignored path, where
# `--include-ignored` is required.

command -v jq >/dev/null 2>&1 || exit 0

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty')
[ -z "$CMD" ] && exit 0
[ -n "$CWD" ] && cd "$CWD" 2>/dev/null

STRIPPED="${CMD#rtk }"

emit() {
  jq -n --arg msg "$1" '{
    "hookSpecificOutput": {
      "hookEventName": "PostToolUse",
      "additionalContext": $msg
    }
  }'
  exit 0
}

# --- jj file track: did the path actually become tracked? --------------------
if printf '%s' "$STRIPPED" | grep -qE '(^|[[:space:];&|])jj[[:space:]]+file[[:space:]]+track'; then
  if printf '%s' "$STRIPPED" | grep -q -- '--include-ignored'; then exit 0; fi
  tracked=$(jj file list 2>/dev/null)
  missing=""
  for arg in $(printf '%s' "$STRIPPED" | sed -E 's/.*file[[:space:]]+track[[:space:]]+//'); do
    case "$arg" in -*) continue ;; esac
    printf '%s\n' "$tracked" | grep -qxF "$arg" || missing+="  $arg"$'\n'
  done
  [ -z "$missing" ] && exit 0
  emit "⚠️ \`jj file track\` exited 0 but these paths are still untracked:

$missing
An ignored path makes \`jj file track\` a silent no-op. Re-run it with
\`jj file track --include-ignored <path>\`, then check \`git check-ignore -v <path>\`
for the rule that hid it — a directory carrying a bare \`*\` swallows every file
added later. Sweep for earlier losses too (\`jj file list\` against \`ls\`): one
ignore rule loses every file added since it started matching."
fi

# --- a commit: show what it contains, not what it claims ---------------------
if printf '%s' "$STRIPPED" | grep -qE '(^|[[:space:];&|])jj[[:space:]]+(commit|ci)([[:space:]]|$)'; then
  stat=$(jj diff -r @- --stat 2>/dev/null)
  label="jj diff -r @- --stat"
elif printf '%s' "$STRIPPED" | grep -qE '(^|[[:space:];&|])git[[:space:]]+commit([[:space:]]|$)'; then
  stat=$(git show --stat --format='%h %s' HEAD 2>/dev/null)
  label="git show --stat HEAD"
else
  exit 0
fi

[ -z "$stat" ] && exit 0

emit "Commit contents per \`$label\`:

$stat

Confirm every file you meant to commit is listed above. A path that is absent was
hidden by an ignore rule, not by an error — check \`git check-ignore -v <path>\`.
Do not report the commit as done until the list matches your intent."
