#!/usr/bin/env bash
# Ties a TODO in `impl` to the Claude session that implements it, and reminds that session to write
# its traps to the TODO's `## Gotchas`.
#
#   todo-session.sh prompt   UserPromptSubmit: a prompt with `impl TODO-N` stamps `session: <id>` in
#                            TODO-N.md; then every `status: impl` TODO of this session gets a reminder line.
#   todo-session.sh skill    PreToolUse(Skill): the `code` / `impl` skill with `impl TODO-N` args stamps it.
#   todo-session.sh commit   PostToolUse(Bash): a `git commit --fixup` of this session gets the reminder,
#                            because a fixup means a trap was found. Reaches subagents too.
#
# The notes dir is the first `.notes` at or above cwd. Silent when no TODO matches.
set -euo pipefail

MODE="${1:-}"
INPUT=$(cat)
field() { echo "$INPUT" | jq -r "$1 // \"\"" 2>/dev/null || true; }

SESSION=$(field .session_id)
CWD=$(field .cwd)
[[ -n "$SESSION" && -n "$CWD" && -d "$CWD" ]] || exit 0

notes=""
dir="$CWD"
while :; do
  if [[ -d "$dir/.notes" ]]; then notes="$dir/.notes"; break; fi
  parent=$(dirname "$dir")
  [[ "$parent" == "$dir" ]] && exit 0
  dir="$parent"
done
notes=$(cd "$notes" && pwd -P)

todo_file() {
  find "$notes" -path '*/todos/TODO-'"$1"'.md' -not -path '*/archived/*' 2>/dev/null | head -1
}

# stamp_session N: write `session: <id>` into the frontmatter of TODO-N.md, after `status:`.
stamp_session() {
  local file
  file=$(todo_file "$1")
  [[ -n "$file" ]] || return 0
  SESSION="$SESSION" perl -0pi -e '
    my $id = $ENV{SESSION};
    s{\A(---\n.*?)(\n---\n)}{
      my ($head, $end) = ($1, $2);
      if ($head =~ /^session:/m) { $head =~ s/^session:[^\n]*/session: $id               # the Claude session that runs impl; written by bin\/todo-session.sh/m; }
      else { $head =~ s/^(status:[^\n]*)/$1\nsession: $id               # the Claude session that runs impl; written by bin\/todo-session.sh/m; }
      "$head$end"
    }se;
  ' "$file"
}

# reminder: one line per `status: impl` TODO whose `session:` is this session.
reminder() {
  local file n agent
  while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    head -20 "$file" | grep -q '^status:[[:space:]]*impl' || continue
    head -20 "$file" | grep -q "^session:[[:space:]]*$SESSION" || continue
    n=$(basename "$file" .md)
    agent="${file%.md}.agent.md"
    echo "You implement $n (status impl). Write each trap you meet — a wrong assumption, a command that fails in a non-obvious way, a review finding that a rule did not prevent — to $agent ## Gotchas before the next edit (capture-gotcha skill format); squash promotes them to GOTCHAS.md."
  done < <(find "$notes" -path '*/todos/TODO-*.md' -not -name '*.agent.md' -not -name '*.test.md' -not -path '*/archived/*' 2>/dev/null)
}

case "$MODE" in
  prompt)
    n=$(field .prompt | grep -oE 'impl[[:space:]]+TODO-[0-9]+' | head -1 | grep -oE '[0-9]+$' || true)
    [[ -n "$n" ]] && stamp_session "$n"
    reminder
    ;;
  skill)
    skill=$(field .tool_input.skill)
    case "$skill" in code|wm:code|wm:code:impl|impl|wm:impl|wm-code-impl) ;; *) exit 0 ;; esac
    n=$(field .tool_input.args | grep -oE 'TODO-[0-9]+' | head -1 | grep -oE '[0-9]+$' || true)
    if [[ -n "$n" ]] && { [[ "$skill" == *impl* ]] || field .tool_input.args | grep -qE '^[[:space:]]*impl'; }; then
      stamp_session "$n"
    fi
    ;;
  commit)
    cmd=$(field .tool_input.command)
    [[ "$cmd" == *"git commit"* && ( "$cmd" == *"--fixup"* || "$cmd" == *"fixup!"* ) ]] || exit 0
    text=$(reminder)
    [[ -n "$text" ]] || exit 0
    jq -n --arg t "A fixup landed. $text" \
      '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $t}}'
    ;;
esac
exit 0
