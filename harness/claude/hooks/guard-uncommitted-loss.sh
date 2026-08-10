#!/usr/bin/env bash
# PreToolUse hook for Bash.
# Blocks a revert that would destroy uncommitted work, and allows the same
# command when the target carries nothing to lose.
#
# `git restore <path>` reverts to HEAD, not to the state before your experiment.
# Uncommitted edits in that path die with no reflog to recover them. The rule is
# not "never restore" — it is "restore only what was already clean", so this hook
# asks git which paths are dirty and blocks only those.
#
# `git checkout` is blocked separately by block-branch-change.sh.

command -v jq >/dev/null 2>&1 || exit 0

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty')
[ -z "$CMD" ] && exit 0
[ -n "$CWD" ] && cd "$CWD" 2>/dev/null

# Drop a leading `rtk ` wrapper, env assignments, and command prefixes.
STRIPPED="${CMD#rtk }"
STRIPPED=$(printf '%s' "$STRIPPED" | sed -E 's/^[[:space:]]*(env|sudo|command|builtin|exec|nohup)[[:space:]]+//')
STRIPPED=$(printf '%s' "$STRIPPED" | sed -E 's/^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+//')

read -r -a ARGV <<<"$STRIPPED"
[ "${ARGV[0]:-}" = "git" ] || exit 0
SUB="${ARGV[1]:-}"

case "$SUB" in
  restore|stash|clean) ;;
  *) exit 0 ;;
esac

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

block() {
  printf 'BLOCKED: %s\n\n%s\n' "$1" "$2" >&2
  exit 2
}

dirty_all=$(git status --short 2>/dev/null)

if [ "$SUB" = "stash" ]; then
  ACTION="${ARGV[2]:-push}"
  case "$ACTION" in
    push|save|-u|--include-untracked|-a|--all) ;;
    -*) ACTION="push" ;;
    *) exit 0 ;;  # pop / apply / list / show / drop / branch keep the tree
  esac
  [ -z "$dirty_all" ] && exit 0
  block "\`git stash\` would hide the user's uncommitted work." \
"Uncommitted changes are usually the change under test, so stashing them measures
the fix as the baseline. Build from an explicit ref in a separate worktree instead:

  git worktree add --detach <path> <ref>

If the user asked for a stash, let them run it themselves."
fi

if [ "$SUB" = "clean" ]; then
  printf '%s\n' "$STRIPPED" | grep -qE '(^|[[:space:]])-[a-zA-Z]*[fdx]' || exit 0
  [ -z "$(git status --short --untracked-files=all 2>/dev/null)" ] && exit 0
  block "\`git clean\` deletes untracked files that no reflog can recover." \
"Remove the specific files by name, or run the experiment in a scratch worktree so
nothing needs cleaning."
fi

# --- git restore -------------------------------------------------------------
paths=()
skip_next=0
seen_ddash=0
for arg in "${ARGV[@]:2}"; do
  if [ "$skip_next" = 1 ]; then skip_next=0; continue; fi
  if [ "$seen_ddash" = 0 ]; then
    case "$arg" in
      --) seen_ddash=1; continue ;;
      -s|--source) skip_next=1; continue ;;
      -*) continue ;;
    esac
  fi
  paths+=("$arg")
done

if [ ${#paths[@]} -eq 0 ]; then
  block "\`git restore\` with no path reverts the whole tree to HEAD." \
"Name the files to restore, and only the ones that were already clean before your
experiment. \`git status --short\` shows which are dirty."
fi

lost=""
for p in "${paths[@]}"; do
  d=$(git status --short -- "$p" 2>/dev/null)
  [ -n "$d" ] && lost+="$d"$'\n'
done

[ -z "$lost" ] && exit 0

block "\`git restore\` would discard uncommitted work in these paths:" \
"$lost
Back each one up first (\`cp\`), or restore only the paths that were clean before
your experiment. For a file that was already dirty, restore your backup — not HEAD.
An uncommitted removal is a deliberate in-progress change: follow it forward by
updating the stale test or caller, do not re-add the removed code."
