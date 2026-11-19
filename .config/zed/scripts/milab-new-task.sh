#!/usr/bin/env bash
# Ask for a task name, create the MILAB task workspace, and set up its .notes for the wm plugin.
set -euo pipefail

workspace="$HOME/git/mil"
note_declare="$HOME/git/dotfiles/harness/plugins/wm/bin/note-declare.sh"

name=""
prompt='Task name (MILAB-1234 short description): '
while [[ -z $name ]]; do
	read -r -p "$prompt" name || exit 0
	name=$(printf '%s' "$name" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')
	prompt='Task name (must not be empty): '
done

task_id=$(printf '%s' "$name" | grep -oiE '^[a-z]+-[0-9x]+' | tr '[:lower:]' '[:upper:]' || true)
rest=${name:${#task_id}}
[[ -n $task_id ]] || task_id="MILAB-XXXX"
context=$(printf '%s' "$rest" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' | cut -c1-50 | sed -E 's/-+$//')
[[ -n $context ]] || {
	echo "milab-new-task: the name has no description after the task id: $name" >&2
	exit 1
}

task_folder="$workspace/tasks/$task_id-$context"
branch="$task_id/$context"
echo "task: $task_folder ($branch)"

(cd "$workspace" && mise run task "$task_id" "$context")
[[ -d $task_folder ]] || {
	echo "milab-new-task: the task folder was not created: $task_folder" >&2
	exit 1
}

"$note_declare" "$task_folder"
# wm code mode is on while the checked-out branch contains this slug.
printf '%s\n' "$branch" >"$task_folder/.notes/code-mode"
echo "wm: code mode on for branch $branch"

folders=("$task_folder")
while IFS= read -r folder; do folders+=("$folder"); done < <(
	python3 -c 'import json, sys; print("\n".join(json.load(open(sys.argv[1]))["folders"]))' "$task_folder/task.json"
)
/Applications/Zed.app/Contents/MacOS/cli --existing "${folders[@]}"
echo "done: $task_folder"
