#!/usr/bin/env bash
# Launch lumen's diff viewer filtered to the paths listed in a file.
#
# lumen takes one -f/--file per path, so a triaged shortlist (say the 48 "decision"
# files of an 83-file PR) is unwieldy to pass by hand. This turns a newline-delimited
# list into that argument vector.
#
# Run it from a real terminal: lumen is a full-screen TUI and dies with EAGAIN
# (os error 35) when started from a call with no controlling tty. From a Claude
# session, prefix the command with `!` so it runs in the session's own terminal.
#
# A GitHub reference (--pr N, or a PR number/URL as REFERENCE) makes lumen call `gh`,
# which for milaboratory/* needs the vgpopov account. A local range like
# main...my-branch needs no network and no auth — prefer it.
set -euo pipefail

usage() {
	cat >&2 <<'EOF'
usage: lumen-files.sh <file-list> [lumen-diff-args...]

  <file-list>  one path per line, relative to the repo root. Parsed by
               lumen-file-list.sh: blanks skipped, `#` starts a comment either on
               its own line or after a path. Use - to read the list from stdin.

  lumen-files.sh shortlist.txt main...my-branch
  lumen-files.sh shortlist.txt --pr 2130
  git diff --name-only main | lumen-files.sh - main...HEAD

Run from the worktree holding the branch. In the viewer: `i` annotates the selection,
`I` lists annotations, `s` then Enter exits and writes them to stdout, `q` quits with
no output.
EOF
	exit 2
}

[[ $# -ge 1 ]] || usage
[[ $1 == --help || $1 == -h ]] && usage

list=$1
shift

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)

mapfile -t paths < <("$here/lumen-file-list.sh" "$list")

[[ ${#paths[@]} -gt 0 ]] || { printf 'file list %s has no paths\n' "$list" >&2; exit 1; }

command -v lumen >/dev/null || { printf 'lumen not on PATH\n' >&2; exit 1; }

# Named separately from the diff-range args so a typo in the list cannot be read as
# a lumen flag.
args=()
for path in "${paths[@]}"; do
	args+=(--file "$path")
done

printf 'lumen diff over %d file(s)%s\n' "${#paths[@]}" "${1:+ · $*}" >&2

exec lumen diff "$@" "${args[@]}"
