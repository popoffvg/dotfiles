#!/usr/bin/env bash
# List open question thoughts (type: question, status: open) in a wm thoughts dir.
# Exit 0 = none open (spec may pass the gate), 1 = at least one open, 2 = usage/dir error.
set -euo pipefail

usage() {
	cat >&2 <<'EOF'
usage: wm-open-questions.sh [thoughts-dir] [--count|--files]

  thoughts-dir  default: <first existing of>  .notes/thoughts  _notes/thoughts  ./thoughts
  --count       print only the number of open questions
  --files       print only the file paths (one per line)

Default output: one line per open question — id  title  (file)
Exit code: 0 none open · 1 one or more open · 2 usage or missing dir.
EOF
	exit 2
}

dir=""
mode="list"
for arg in "$@"; do
	case "$arg" in
	--count) mode="count" ;;
	--files) mode="files" ;;
	-h | --help) usage ;;
	-*) usage ;;
	*) dir="$arg" ;;
	esac
done

if [[ -z $dir ]]; then
	for candidate in .notes/thoughts _notes/thoughts thoughts; do
		[[ -d $candidate ]] && dir="$candidate" && break
	done
fi
[[ -n $dir && -d $dir ]] || {
	echo "wm-open-questions: no thoughts dir (tried '${dir:-.notes/thoughts _notes/thoughts thoughts}')" >&2
	exit 2
}

open_files=()
while IFS= read -r f; do
	# frontmatter only: the first --- block. type: question AND status: open.
	fm=$(awk 'NR==1 && $0!="---"{exit} NR>1{ if ($0=="---") exit; print }' "$f")
	[[ $fm == *"type: question"* && $fm == *"status: open"* ]] && open_files+=("$f")
done < <(find "$dir" -maxdepth 1 -name '*-question-*.md' -type f | sort)

count=${#open_files[@]}

case "$mode" in
count) echo "$count" ;;
files) printf '%s\n' "${open_files[@]+"${open_files[@]}"}" ;;
list)
	if ((count == 0)); then
		echo "no open questions in $dir"
	else
		for f in "${open_files[@]}"; do
			id=$(basename "$f" | cut -d- -f1)
			title=$(grep -m1 '^# ' "$f" | sed 's/^# //')
			printf '%s  %s  (%s)\n' "$id" "${title:-<no title>}" "$f"
		done
		echo "---"
		echo "$count open question(s) — the spec is NOT ready ($dir)"
	fi
	;;
esac

((count == 0)) || exit 1
