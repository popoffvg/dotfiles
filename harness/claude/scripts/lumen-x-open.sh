#!/usr/bin/env bash
# Open lumen on the files a `/lumen-x` triage selected, read from a list file.
#
# The selection is a review artifact, not a command line. Written to a file it can
# be read back, diffed against the next run, and edited by the operator — drop a
# file the triage over-reported, add one it missed, re-run this script. A 30-file
# `--file a --file b ...` invocation composed by the model is none of those things,
# and it is where a path quietly goes missing.
#
# Every path is checked against the saved diff before the viewer opens: lumen
# shows a path it cannot find in the diff as nothing at all, which reads to the
# reviewer as "no changes here" rather than as the typo it is.
#
# The reference lumen needs — nothing for the working tree, a range, `--pr N` — is
# whatever lumen-x-diff.sh already resolved and saved beside the diff, so a local
# review and a PR review are the same call here.
set -euo pipefail

usage() {
	cat >&2 <<'EOF'
usage: lumen-x-open.sh [--wait] [--ref <reference>] <slug> [<list-file>]

  lumen-x-open.sh --wait local
  lumen-x-open.sh --wait pr-123
  lumen-x-open.sh --wait 123                      # bare number means pr-123
  lumen-x-open.sh --wait main-HEAD /path/to/other.files
  lumen-x-open.sh --wait --ref main...my-branch pr-123

The slug is the one lumen-x-diff.sh printed. It names every file of the review:

  $TMPDIR/lumen-x-<slug>.files   the selection, one path per line (overridable)
  $TMPDIR/lumen-x-<slug>.diff    validated against, so no path opens empty
  $TMPDIR/lumen-x-<slug>.ref     the reference handed to lumen

`#` starts a comment: a whole-line note, or a reason after a path —
  src/pay/charge.go   # decision: new fallback when the token is missing

--wait blocks until the viewer exits, then prints the annotations.

--ref overrides the saved reference with a local one (`main...my-branch`). Reach for
it when a PR review is opening as `--pr <number>`, which makes lumen shell out to
`gh`: that needs an account which can resolve the repo, and for a private org repo
the wrong active account fails with "Could not resolve to a Repository". A local
range needs no network and no account at all.
EOF
	exit 2
}

wait_arg=()
reference=()
while :; do
	case ${1:-} in
	--wait) wait_arg=(--wait); shift ;;
	--ref)
		[[ -n ${2:-} ]] || usage
		reference=("$2")
		shift 2
		;;
	--help | -h) usage ;;
	*) break ;;
	esac
done
[[ $# -ge 1 && $# -le 2 ]] || usage

slug=$1
# A bare number is the PR slug spelled the way a reviewer says it out loud.
[[ $slug =~ ^[0-9]+$ ]] && slug="pr-${slug}"
# The slug reaches the filesystem, so it may not carry a path of its own.
[[ $slug =~ ^[A-Za-z0-9._-]+$ ]] || { printf 'not a slug: %s\n' "$1" >&2; usage; }

tmp=${TMPDIR:-/tmp}
list=${2:-${tmp}/lumen-x-${slug}.files}
diff_file="${tmp}/lumen-x-${slug}.diff"
ref_file="${tmp}/lumen-x-${slug}.ref"
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)

[[ -r $list ]] || { printf 'no list file: %s\n' "$list" >&2; exit 1; }

mapfile -t files < <("$here/lumen-file-list.sh" "$list")

[[ ${#files[@]} -gt 0 ]] || {
	printf 'nothing to open — %s lists no path\n' "$list" >&2
	printf 'that is the correct outcome when triage found no decision file and no anomaly\n' >&2
	exit 1
}

# The diff is the authority on which paths the review touches. Absent (a list carried
# over from another machine), opening is still better than refusing.
if [[ -r $diff_file ]]; then
	"$here/lumen-x-diff-slice.sh" "$diff_file" "${files[@]}" >/dev/null || {
		printf 'fix %s, then re-run\n' "$list" >&2
		exit 1
	}
fi

printf 'opening %d file(s) from %s\n' "${#files[@]}" "$list"

# An empty reference is a real answer, not a missing one: no argument at all is how
# lumen is asked for the working tree. So the saved file decides only when --ref did
# not, and an empty one leaves the vector empty on purpose.
if [[ ${#reference[@]} -eq 0 && -r $ref_file ]]; then
	mapfile -t reference < <(grep -v '^[[:space:]]*$' "$ref_file" || true)
fi

# The list is expanded into lumen's `--file` vector inside the pane, not here. The pane
# receives its command as keystrokes on the tty, and a tty in canonical mode discards a
# line past MAX_CANON — 1024 bytes on macOS — mid-token, so a 30-file vector arrives cut
# in half and the shell never runs it. Handing over the short command that reads the list
# itself keeps the typed line a fixed size however long the selection grows.
pane_cmd=$(printf '%q ' "$here/lumen-files.sh" "$list" ${reference[@]+"${reference[@]}"})

# The slug is in the pane label so a second review opens its own viewer: the label is
# the identity lumen-pane.sh re-focuses on, and one shared label would raise the pane
# still showing the previous review's files.
exec "$here/lumen-pane.sh" "${wait_arg[@]}" "lumen-x-${slug}" --cmd "${pane_cmd% }"
