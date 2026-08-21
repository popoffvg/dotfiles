#!/usr/bin/env bash
# Print the paths a lumen file-list holds, one per line, comments and blanks removed.
#
# The list is a review artifact the operator edits, so it carries notes: a whole-line
# header and a reason after each path.
#
#   # lumen-x #123 — 2 of 34 files carry a decision
#   src/pay/charge.go   # decision: new fallback when the token is missing
#
# One definition site, because two consumers read the same file for different reasons —
# lumen-x-open.sh validates the paths against the saved diff, lumen-files.sh turns them
# into lumen's argument vector — and a parser that disagreed between them would drop a
# path from one and not the other.
set -euo pipefail

[[ $# -eq 1 && $1 != --help && $1 != -h ]] || {
	printf 'usage: lumen-file-list.sh <list-file>   (- reads stdin)\n' >&2
	exit 2
}

list=$1
[[ $list == - || -r $list ]] || { printf 'lumen-file-list: cannot read %s\n' "$list" >&2; exit 1; }

# awk, not `sed | grep -v '^$'`: grep exits 1 when every line was a comment, and the
# `|| true` needed to tolerate that legitimately-empty list would equally swallow a read
# error — turning "cannot open" into "no paths", the silent drop this parser exists to
# stop. awk exits 0 on empty output and non-zero on a bad read. It also takes `-` for
# stdin, which BSD sed reads as a literal filename.
awk '
	{
		sub(/#.*/, "")
		gsub(/^[[:space:]]+|[[:space:]]+$/, "")
		if ($0 != "") print
	}
' "$list"
