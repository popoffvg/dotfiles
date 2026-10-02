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
       open-file.sh --host                   # print zed, herdr, or none

  open-file.sh notes.md                 # open, return at once
  open-file.sh --wait answers.md        # block until the operator is done

--wait blocks until the operator is done: in a herdr pane, until the editor
closes; in Zed, until a save followed by 3 s with no save.

Env: EDITOR picks the editor for the herdr pane (default: hx).
EOF
	exit 2
}

wait_for_close=0
[[ ${1:-} == --wait ]] && { wait_for_close=1; shift; }
[[ $# -ge 1 ]] || usage
[[ $1 == --help || $1 == -h ]] && usage

in_zed() { [[ -n ${ZED_TERM:-} || ${TERM_PROGRAM:-} == zed ]] && command -v zed >/dev/null; }
in_herdr() { [[ -n ${HERDR_PANE_ID:-} ]] && command -v herdr >/dev/null; }

if [[ $1 == --host ]]; then
	if in_zed; then echo zed; elif in_herdr; then echo herdr; else echo none; fi
	exit 0
fi

for f in "$@"; do
	[[ -e $f ]] || { printf 'no such file: %s\n' "$f" >&2; exit 1; }
done

print_paths() { printf '%s\n' "$@"; }

mtimes() { stat -f %m "$@"; }

# zed --wait returns while the tab stays open, so a Zed wait polls the files:
# it ends after a save followed by settle_seconds with no further save.
wait_for_save() {
	local settle_seconds=3 before now last_save=-1
	before=$(mtimes "$@")
	for _ in $(seq 1 7200); do
		sleep 1
		now=$(mtimes "$@")
		if [[ $now != "$before" ]]; then
			before=$now
			last_save=$SECONDS
		elif (( last_save >= 0 && SECONDS - last_save >= settle_seconds )); then
			return 0
		fi
	done
	printf 'no save after 2h: %s\n' "$*" >&2
	return 1
}

if in_zed; then
	# Zed answers over a Mach port; a sandboxed caller fails with "Unknown Mach error".
	zed --existing -- "$@" || {
		printf 'zed --existing failed — run open-file.sh outside the sandbox\n' >&2
		exit 1
	}
	print_paths "$@"
	(( wait_for_close )) || exit 0
	wait_for_save "$@"
	exit
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
