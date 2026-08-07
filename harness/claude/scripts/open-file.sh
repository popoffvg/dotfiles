#!/usr/bin/env bash
# open-file.sh — put a file in front of the operator in whichever host this session
# runs in. Every skill that hands back an editable file calls this instead of
# picking an editor itself.
#
# Host, in order:
#   Zed terminal  → `zed --existing`, so the file lands in the window already open.
#   herdr pane    → an editor in a split under the calling pane, zoomed to full width.
#   anything else → print the path and open nothing; a TUI editor started from a
#                   Claude Code Bash call has no tty and dies with EAGAIN (os error 35).
#
# Zed wins over herdr when both apply: a herdr running inside a Zed terminal still
# has a real editor one keystroke away, and a pane editor would hide it.
set -euo pipefail

usage() {
	cat >&2 <<'EOF'
usage: open-file.sh [--wait] <file> [file...]

  open-file.sh notes.md                 # open, return at once
  open-file.sh --wait answers.md        # block until the operator closes it

--wait blocks until the file is closed, for a batch the operator must answer
before the caller can read it back.

Env: EDITOR picks the editor for the herdr pane (default: hx).
EOF
	exit 2
}

wait_for_close=0
[[ ${1:-} == --wait ]] && { wait_for_close=1; shift; }
[[ $# -ge 1 ]] || usage
[[ $1 == --help || $1 == -h ]] && usage

for f in "$@"; do
	[[ -e $f ]] || { printf 'no such file: %s\n' "$f" >&2; exit 1; }
done

in_zed() { [[ -n ${ZED_TERM:-} || ${TERM_PROGRAM:-} == zed ]] && command -v zed >/dev/null; }
in_herdr() { [[ -n ${HERDR_PANE_ID:-} ]] && command -v herdr >/dev/null; }

print_paths() { printf '%s\n' "$@"; }

if in_zed; then
	# --existing reuses the open window; --wait returns only when the tab closes.
	if (( wait_for_close )); then
		zed --existing --wait -- "$@"
	else
		zed --existing -- "$@"
	fi
	print_paths "$@"
	exit 0
fi

if in_herdr; then
	editor=${EDITOR:-hx}
	command -v "$editor" >/dev/null || { printf '%s not on PATH\n' "$editor" >&2; exit 1; }
	# Every step below talks to the herdr socket; a sandboxed caller cannot reach it.
	herdr status server 2>/dev/null | grep -q '^status: running' || {
		printf 'cannot reach the herdr server — not running, or this shell is sandboxed away from the socket\n' >&2
		exit 1
	}
	pane=$(herdr pane split "$HERDR_PANE_ID" --direction down --cwd "$PWD" --focus \
		| jq -er '.result.pane.pane_id')
	# exec replaces the shell, so closing the editor ends the pane and the split
	# collapses back to the caller. Zoom first: a half-height split is a poor editor.
	herdr pane zoom "$pane" --on >/dev/null
	cmd=$(printf '%q ' "$editor" "$@")
	herdr pane run "$pane" "exec ${cmd% }" >/dev/null
	print_paths "$@"
	(( wait_for_close )) || exit 0
	# Two hours is a backstop, not an expected wait.
	for _ in $(seq 1 3600); do
		herdr pane get "$pane" 2>/dev/null | grep -q '"pane_id"' || exit 0
		sleep 2
	done
	printf 'editor still open after 2h in pane %s\n' "$pane" >&2
	exit 1
fi

print_paths "$@"
