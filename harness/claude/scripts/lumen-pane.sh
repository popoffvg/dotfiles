#!/usr/bin/env bash
# Open lumen's diff viewer over the claude pane that asked for it and collect the
# annotations it writes on exit.
#
# lumen diff is a full-screen TUI, so it cannot run in a Claude Code Bash call —
# that has no controlling terminal and the program dies with EAGAIN (os error 35).
# The viewer opens as a split under the caller and is then zoomed: the side-by-side
# diff needs the whole window, but it belongs in the caller's tab, not a tab of
# its own.
#
# In the viewer: `i` annotates the selection, `I` lists annotations, `s` then
# Enter exits and writes them to stdout. Plain `q` quits with no output.
set -euo pipefail

usage() {
	cat >&2 <<'EOF'
usage: lumen-pane.sh [--wait] <pane-label> [lumen-diff-args...]
       lumen-pane.sh [--wait] <pane-label> --cmd <command-line>

  lumen-pane.sh --wait lumen-diff --watch      # working-tree diff
  lumen-pane.sh --wait lumen-last HEAD~1..HEAD # the last commit
  lumen-pane.sh --wait lumen-pr --detect-pr    # the PR for this branch

The pane label is the identity: running the same label again focuses that pane
instead of opening a second copy.

--wait blocks until the viewer exits, then prints the annotations. Without it
the script returns at once and prints the annotation file path.

--cmd runs the given command line in the pane instead of `lumen diff <args>`, for
a viewer whose arguments do not fit in one typed line. The command reaches the
pane's tty as keystrokes, and a tty in canonical mode discards a line past
MAX_CANON (1024 bytes on macOS) mid-token, so a long `--file` vector arrives
truncated and the shell never runs it. Pass a short command that expands the list
itself:

  lumen-pane.sh --wait lumen-x --cmd \
    "$HOME/.claude/scripts/lumen-files.sh shortlist.txt main...my-branch"

Whatever it runs must write its annotations to stdout, which is redirected for it.
EOF
	exit 2
}

wait_for_exit=0
[[ ${1:-} == --wait ]] && { wait_for_exit=1; shift; }
[[ $# -ge 1 ]] || usage
[[ $1 == --help || $1 == -h ]] && usage
label=$1
shift

# Captured before the herdr calls so a --cmd typo fails on its own terms rather
# than after a pane has been split.
pane_cmd=
if [[ ${1:-} == --cmd ]]; then
	[[ $# -eq 2 ]] || { printf -- '--cmd takes exactly one command line\n' >&2; exit 2; }
	pane_cmd=$2
	shift 2
fi

command -v herdr >/dev/null || { printf 'herdr not on PATH\n' >&2; exit 1; }
command -v lumen >/dev/null || { printf 'lumen not on PATH\n' >&2; exit 1; }

# Every step below talks to the herdr socket. A sandboxed caller cannot reach it,
# and `set -e` would then end the script with a bare exit 1 that reads like a lumen
# failure — so name the real cause once, here.
# Captured before matching, not piped into `grep -q`: under `set -o pipefail` grep exits
# on its first match and closes the pipe, herdr dies of SIGPIPE, and the pipeline reports
# failure even though the match succeeded. It only loses the race when herdr is still
# writing — around 1 run in 10 — which reads as an intermittently missing herdr server.
herdr_status=$(herdr status server 2>/dev/null || true)
grep -q '^status: running' <<<"$herdr_status" || {
	printf 'cannot reach the herdr server over %s\n' "${HERDR_SOCKET_PATH:-its socket}" >&2
	printf 'either it is not running, or this shell is sandboxed away from the socket\n' >&2
	exit 1
}

out="${TMPDIR:-/tmp}/lumen-annotations-${label}.md"

# lumen's `e` spawns $EDITOR with the stdout redirected below, so a TUI editor renders
# into the annotation file instead of the terminal. lumen-editor.sh rebinds the editor's
# streams to /dev/tty; the real editor travels separately, since EDITOR now points at the
# wrapper.
editor_env=$(printf '%s=%q %s=%q' \
	LUMEN_REAL_EDITOR "${LUMEN_REAL_EDITOR:-${VISUAL:-${EDITOR:-hx}}}" \
	EDITOR "$HOME/.claude/scripts/lumen-editor.sh")

# exec replaces the shell: quitting the viewer ends the pane and the split collapses
# back to the caller. Without exec the shell prompt would keep the pane open.
if [[ -n $pane_cmd ]]; then
	pane_line="$editor_env exec $pane_cmd > $(printf '%q' "$out")"
else
	pane_line="$editor_env exec $(printf '%q ' lumen diff "$@")> $(printf '%q' "$out")"
fi

# Built and measured before anything is split, so a command the pane cannot receive
# whole fails on its own terms instead of leaving an orphan pane behind. See --cmd in
# usage for why 1024 is the ceiling.
if [[ ${#pane_line} -ge 1024 ]]; then
	printf 'command is %d bytes; the pane tty truncates it at 1024 — pass --cmd instead\n' "${#pane_line}" >&2
	exit 1
fi

# The caller is the claude pane the viewer must open over. Inside a herdr pane the
# id is in the environment; claude started outside herdr (a Zed terminal) has none,
# so fall back to the claude pane rooted at this folder. Without a caller, herdr
# would drop the viewer into whatever workspace happens to be focused.
caller=${HERDR_PANE_ID:-}
if [[ -z $caller ]]; then
	# Several workspaces can hold a claude on the same folder, and picking one the
	# user is not looking at opens the viewer in another window. The focused
	# workspace is the one in front of them, so try it first.
	focused=$(herdr workspace list | jq -r 'first(.result.workspaces[]? | select(.focused) | .workspace_id) // empty')
	caller=$(herdr pane list | jq -r --arg cwd "$PWD" --arg ws "$focused" \
		'[.result.panes[]? | select(.cwd == $cwd and .agent == "claude")]
		 | (map(select(.workspace_id == $ws)) + .) | first | .pane_id // empty')
fi
[[ -n $caller ]] || { printf 'no claude pane for %s — launch claude with claudex\n' "$PWD" >&2; exit 1; }

workspace=$(herdr pane get "$caller" | jq -r '.result.pane.workspace_id // empty')

# `pane list` reports no label, so the identity check asks each pane for its own.
pane_labelled() {
	local id
	for id in $(herdr pane list --workspace "$workspace" | jq -r '.result.panes[]?.pane_id'); do
		[[ $(herdr pane get "$id" | jq -r '.result.pane.label // empty') == "$1" ]] || continue
		printf '%s' "$id"
		return
	done
}

# Strip the terminal query escapes lumen emits before its markdown.
clean_annotations() {
	[[ -s $out ]] || { printf 'no annotations — the viewer was closed with q\n'; return; }
	local text
	text=$(perl -pe 's/\e\][^\a]*\a//g; s/\e\[[0-9;?]*[a-zA-Z]//g' "$out")
	[[ -n ${text//[[:space:]]/} ]] || { printf 'no annotations — the viewer was closed with q\n'; return; }
	printf '%s\n' "$text"
}

pane_alive() {
	# Captured before matching for the same reason as the server check above: piped into
	# `grep -q` under pipefail this reports a live pane as dead whenever grep wins the
	# race, which ends the --wait loop early and prints "no annotations" over a viewer
	# the operator still has open.
	local info
	info=$(herdr pane get "$1" 2>/dev/null || true)
	grep -q '"pane_id"' <<<"$info"
}

existing=$(pane_labelled "$label")

if [[ -n $existing ]]; then
	# zoom --on also focuses, so one call both raises and fills the window.
	herdr pane zoom "$existing" --on >/dev/null
	printf 'already open — focused %s in pane %s\n' "$label" "$existing"
	# --wait re-attaches to the viewer already on screen: a caller whose wait died
	# (killed shell, lost session) must be able to collect the annotations without
	# the user reopening the diff. The annotation file is left untouched — the
	# running lumen still holds it open as its stdout.
	[[ $wait_for_exit -eq 1 ]] || exit 0
	root=$existing
else
	: >"$out"

	created=$(herdr pane split "$caller" --direction down --cwd "$PWD" --focus)
	root=$(printf '%s' "$created" | jq -er '.result.pane.pane_id') || {
		printf 'herdr pane split returned no pane id:\n%s\n' "$created" >&2
		exit 1
	}
	herdr pane rename "$root" "$label" >/dev/null
	herdr pane zoom "$root" --on >/dev/null

	herdr pane run "$root" "$pane_line" >/dev/null

	printf 'opened %s in pane %s under %s\n' "$label" "$root" "$caller"
	printf 'annotations: %s\n' "$out"
fi

[[ $wait_for_exit -eq 1 ]] || exit 0

# Poll until the pane dies. Two hours is a backstop, not an expected wait.
for _ in $(seq 1 3600); do
	pane_alive "$root" || break
	sleep 2
done

if pane_alive "$root"; then
	printf 'still open after 2h — read %s yourself\n' "$out" >&2
	exit 1
fi

printf -- '--- annotations ---\n'
clean_annotations
