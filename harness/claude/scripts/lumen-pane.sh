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

  lumen-pane.sh --wait lumen-diff --watch      # working-tree diff
  lumen-pane.sh --wait lumen-last HEAD~1..HEAD # the last commit
  lumen-pane.sh --wait lumen-pr --detect-pr    # the PR for this branch

The pane label is the identity: running the same label again focuses that pane
instead of opening a second copy.

--wait blocks until the viewer exits, then prints the annotations. Without it
the script returns at once and prints the annotation file path.
EOF
	exit 2
}

wait_for_exit=0
[[ ${1:-} == --wait ]] && { wait_for_exit=1; shift; }
[[ $# -ge 1 ]] || usage
[[ $1 == --help || $1 == -h ]] && usage
label=$1
shift

command -v herdr >/dev/null || { printf 'herdr not on PATH\n' >&2; exit 1; }
command -v lumen >/dev/null || { printf 'lumen not on PATH\n' >&2; exit 1; }

# Every step below talks to the herdr socket. A sandboxed caller cannot reach it,
# and `set -e` would then end the script with a bare exit 1 that reads like a lumen
# failure — so name the real cause once, here.
herdr status server 2>/dev/null | grep -q '^status: running' || {
	printf 'cannot reach the herdr server over %s\n' "${HERDR_SOCKET_PATH:-its socket}" >&2
	printf 'either it is not running, or this shell is sandboxed away from the socket\n' >&2
	exit 1
}

out="${TMPDIR:-/tmp}/lumen-annotations-${label}.md"

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
	herdr pane get "$1" 2>/dev/null | grep -q '"pane_id"'
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

	# exec replaces the shell: quitting lumen ends the pane and the split collapses
	# back to the caller. Without exec the shell prompt would keep the pane open.
	cmd=$(printf '%q ' lumen diff "$@")
	herdr pane run "$root" "exec ${cmd% }> $(printf '%q' "$out")" >/dev/null

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
