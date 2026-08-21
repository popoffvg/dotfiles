#!/usr/bin/env bash
# Print the hunks a saved unified diff holds for the named paths.
#
# Triage fans one cheap subagent out per batch of files, and a subagent handed
# the whole diff spends its context finding its own slice — the thing the
# fan-out exists to avoid. So the slice is cut here, deterministically, and each
# agent is handed only its own files' hunks.
#
# A path that matches nothing is an error rather than empty output: a typo that
# silently yielded no hunks would read to the caller as "this file changes
# nothing", which is the one wrong answer triage must never produce.
set -euo pipefail

usage() {
	cat >&2 <<'EOF'
usage: lumen-x-diff-slice.sh <diff-file> <path>...

  lumen-x-diff-slice.sh "$TMPDIR/lumen-x-pr-123.diff" src/a.go src/b.go

Prints the `diff --git` sections for the named paths, in the order the diff
holds them. Exits 1 naming any path the diff does not carry.
EOF
	exit 2
}

[[ ${1:-} == --help || ${1:-} == -h ]] && usage
[[ $# -ge 2 ]] || usage

diff_file=$1
shift
[[ -r $diff_file ]] || { printf 'not readable: %s\n' "$diff_file" >&2; exit 1; }

awk -v paths="$*" '
	BEGIN {
		n = split(paths, p, " ")
		for (i = 1; i <= n; i++) want[p[i]] = 1
	}
	/^diff --git / {
		# The b-side path is the last field; a rename prints both sides, and
		# either name is a legitimate way for the caller to ask for the file.
		b = $NF; sub(/^b\//, "", b)
		a = $(NF - 1); sub(/^a\//, "", a)
		inside = (b in want) || (a in want)
		if (b in want) seen[b] = 1
		if (a in want) seen[a] = 1
	}
	inside { print }
	END {
		missing = ""
		for (i = 1; i <= n; i++)
			if (!(p[i] in seen)) missing = missing " " p[i]
		if (missing != "") {
			printf "not in diff:%s\n", missing > "/dev/stderr"
			exit 1
		}
	}
' "$diff_file"
