#!/usr/bin/env bash
# Exit 0 = QUESTIONS.md has no open question, 1 = at least one, 2 = usage or file error.
set -euo pipefail

usage() {
	cat >&2 <<'EOF2'
usage: wm-open-questions.sh [notes-dir|QUESTIONS.md] [--count|--slugs]

  notes-dir  default: the first existing of  .notes  _notes  .
  --count    print only the number of open questions
  --slugs    print only the slugs (one per line)

An open question is one `## <slug>` section in <notes-dir>/QUESTIONS.md.
A missing QUESTIONS.md means no open question.
Default output: one line per question — slug  question
Exit code: 0 none open · 1 one or more open · 2 usage or missing notes dir.
Tool index — every .notes tool and its flags: wm:TOOLS.md
EOF2
	exit 2
}

arg=""
mode="list"
for a in "$@"; do
	case "$a" in
	--count) mode="count" ;;
	--slugs) mode="slugs" ;;
	-h | --help) usage ;;
	-*) usage ;;
	*) arg="$a" ;;
	esac
done

if [[ -n $arg && -f $arg ]]; then
	file="$arg"
else
	dir="$arg"
	if [[ -z $dir ]]; then
		for candidate in .notes _notes .; do
			[[ -d $candidate/adr || -f $candidate/QUESTIONS.md ]] && dir="$candidate" && break
		done
	fi
	[[ -n $dir && -d $dir ]] || {
		echo "wm-open-questions: no notes dir (tried '${dir:-.notes _notes .}')" >&2
		exit 2
	}
	file="$dir/QUESTIONS.md"
fi

slugs=()
questions=()
if [[ -f $file ]]; then
	while IFS=$'\t' read -r slug question; do
		slugs+=("$slug")
		questions+=("$question")
	done < <(awk '
		/^## / { if (slug != "") print slug "\t" q; slug = substr($0, 4); q = ""; next }
		slug != "" && q == "" && /^\*\*Question:\*\*/ { q = $0; sub(/^\*\*Question:\*\*[[:space:]]*/, "", q) }
		END { if (slug != "") print slug "\t" q }' "$file")
fi

count=${#slugs[@]}

case "$mode" in
count) echo "$count" ;;
slugs) printf '%s\n' "${slugs[@]+"${slugs[@]}"}" ;;
list)
	if ((count == 0)); then
		echo "no open question in $file"
	else
		for i in "${!slugs[@]}"; do
			printf '%s  %s\n' "${slugs[$i]}" "${questions[$i]:-<no Question line>}"
		done
		echo "---"
		echo "$count open question(s). The spec is NOT ready ($file)."
	fi
	;;
esac

((count == 0)) || exit 1
