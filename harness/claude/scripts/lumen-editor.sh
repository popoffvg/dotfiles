#!/usr/bin/env bash
# Run the operator's real editor with its three streams bound to the terminal.
#
# Exists for one caller: lumen's `e` (edit file at hunk line). lumen writes its
# annotations to stdout and draws its own TUI straight to /dev/tty, so a wrapper that
# captures the annotations has to redirect stdout to a file — and the editor lumen
# spawns inherits that redirected stdout. helix draws to stdout, so it renders into
# the capture file: the operator sees nothing, and the file fills with screen dump
# where annotations should be. Rebinding here fixes the editor without giving up the
# capture.
#
# Set as EDITOR for the wrapped lumen. The editor it should actually run comes from
# LUMEN_REAL_EDITOR (set by whoever overrode EDITOR), else VISUAL, else hx — never
# EDITOR, which now points back at this script.
set -euo pipefail

editor=${LUMEN_REAL_EDITOR:-${VISUAL:-hx}}

# A word-split is wanted: the value may carry flags (e.g. "code --wait").
# shellcheck disable=SC2206
read -r -a editor_argv <<<"$editor"
[[ ${#editor_argv[@]} -gt 0 ]] || { printf 'lumen-editor: no editor configured\n' >&2; exit 1; }

command -v "${editor_argv[0]}" >/dev/null || {
	printf 'lumen-editor: %s not on PATH\n' "${editor_argv[0]}" >&2
	exit 1
}

# The open is the test, not the existence: /dev/tty is a device node on every system,
# and it is opening it that fails (ENXIO) when the process has no controlling terminal.
# `[[ -e /dev/tty ]]` passes there and the redirect below then dies with a message that
# reads like a missing file.
{ : >/dev/tty; } 2>/dev/null || {
	printf 'lumen-editor: no controlling terminal to hand %s\n' "${editor_argv[0]}" >&2
	exit 1
}

exec "${editor_argv[@]}" "$@" </dev/tty >/dev/tty 2>/dev/tty
