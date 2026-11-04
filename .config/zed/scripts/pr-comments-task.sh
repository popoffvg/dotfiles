#!/usr/bin/env bash
# pr-comments-task.sh <sync|list> — the Zed tasks `pr-comments: sync` and `pr-comments: list`.
#
# Runs `pr-comments-lsp <sync|list>` in a repository, then opens the list page in Zed and
# presses the preview key. The repository:
#   ZED_GIT_REPOSITORY_PATH  when the task starts from a commit or branch menu of the git panel
#   ZED_WORKTREE_ROOT        the folder open in Zed, when it is in a git repository
#   fzf                      over its git repository subfolders, when it is in none
# A failure opens nothing and shows the error as a notification.
set -uo pipefail

command=${1:?usage: pr-comments-task.sh <sync|list>}
log="$HOME/.cache/pr-comments-task.log"
# Not `zed` from the PATH: in a Zed task that can be the app binary, which opens
# `--existing` as a file.
zed_cli=/Applications/Zed.app/Contents/MacOS/cli

notify() {
	osascript -e 'on run argv' -e 'display notification (item 1 of argv) with title "pr-comments"' -e 'end run' "$1"
}

fail() {
	mkdir -p "$(dirname "$log")"
	printf '%s %s\n' "$(date)" "$1" >>"$log"
	notify "$1"
	echo "$1"
	exit 1
}

mkdir -p "$(dirname "$log")"
printf '%s run %s: ZED_GIT_REPOSITORY_PATH=%s ZED_WORKTREE_ROOT=%s\n' "$(date)" "$command" \
	"${ZED_GIT_REPOSITORY_PATH:-}" "${ZED_WORKTREE_ROOT:-}" >>"$log"
dir=${ZED_GIT_REPOSITORY_PATH:-}
source=ZED_GIT_REPOSITORY_PATH
if [[ -z $dir ]]; then
	dir=${ZED_WORKTREE_ROOT:-$PWD}
	source=ZED_WORKTREE_ROOT
fi
if ! git -C "$dir" rev-parse --show-toplevel >/dev/null 2>&1; then
	choices=()
	while IFS= read -r git_dir; do
		repo=$(dirname "$git_dir")
		choices+=("$(basename "$repo") — $(git -C "$repo" branch --show-current)")
	done < <(find "$dir" -mindepth 2 -maxdepth 2 -name .git -not -path '*/.*/.git' | sort)
	[[ ${#choices[@]} -gt 0 ]] || fail "pr-comments: $dir is in no git repository and holds none."
	picked=$(printf '%s\n' "${choices[@]}" | fzf --prompt='repository > ' --header='select the repository of the PR')
	[[ -n $picked ]] || exit 0
	dir="$dir/${picked%% — *}"
	source=fzf
fi

cd "$dir" || fail "pr-comments: cannot enter $dir"
echo "repository: $(git rev-parse --show-toplevel) (from $source)"
errors=$(mktemp)
# The progress lines go to the terminal; the error lines also go to the notification.
out=$(pr-comments-lsp "$command" 2> >(tee "$errors" >&2))
status=$?
wait
[[ $status -eq 0 ]] || fail "$(grep -v '^\[ *[0-9]*%\]' "$errors")"
echo "$out"
"$zed_cli" --existing "$(printf '%s\n' "$out" | tail -1)"
# No task, CLI flag, or language-server request opens a preview, so press Zed's own key for
# `markdown::OpenPreview` once the page has focus. System Events needs Accessibility for Zed.
sleep 0.5
osascript -e 'tell application "Zed" to activate' \
	-e 'tell application "System Events" to keystroke "v" using {command down, shift down}' >/dev/null 2>&1 ||
	notify "No preview: give Zed Accessibility access in System Settings > Privacy & Security, or press cmd-shift-v."
