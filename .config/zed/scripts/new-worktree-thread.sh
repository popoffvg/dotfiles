#!/usr/bin/env bash
# Ask for a task title, create a worktree on a new branch named after it, open the worktree in Zed, and start a terminal thread there.
set -euo pipefail

repo_dir="${ZED_WORKTREE_ROOT:-$PWD}"
repo_root="$(git -C "$repo_dir" rev-parse --show-toplevel)"

title=""
prompt='Task title'
while [[ -z $title ]]; do
	title=$(osascript \
		-e 'on run argv' \
		-e 'text returned of (display dialog (item 1 of argv) default answer "")' \
		-e 'end run' "$prompt" 2>/dev/null) || exit 0
	title=$(printf '%s' "$title" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')
	prompt='Task title (must not be empty)'
done

branch=$(printf '%s' "$title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' | cut -c1-50 | sed -E 's/-+$//')
[[ -n $branch ]] || {
	echo "new-worktree-thread: the title has no letter or digit: $title" >&2
	exit 1
}

worktree_path=$(wt -C "$repo_root" switch --create "$branch" --no-cd --format json |
	python3 -c 'import json, sys; print(json.load(sys.stdin)["path"])')
echo "worktree: $worktree_path ($branch)"

zed_cli=/Applications/Zed.app/Contents/MacOS/cli
"$zed_cli" --existing "$worktree_path"
sleep 1
# ctrl-alt-cmd-t is bound to agent::NewTerminalThread in keymap.json. System Events needs Accessibility for Zed.
osascript -e 'tell application "Zed" to activate' \
	-e 'tell application "System Events" to keystroke "t" using {command down, control down, option down}' >/dev/null 2>&1 || {
	echo "new-worktree-thread: no terminal thread: give Zed Accessibility access, or press ctrl-alt-cmd-t" >&2
	exit 1
}
