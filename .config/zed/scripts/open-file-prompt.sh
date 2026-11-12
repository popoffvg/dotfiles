#!/usr/bin/env bash
# Ask for path[:line[:col]] in a dialog prefilled with the clipboard, open it in the current Zed window.
# A path that does not exist shows the dialog again, so Zed never opens an empty file.
set -uo pipefail

ref=$(pbpaste | head -n 1)
prompt='Open file (path[:line[:col]])'
while :; do
	ref=$(osascript \
		-e 'on run argv' \
		-e 'text returned of (display dialog (item 1 of argv) default answer (item 2 of argv))' \
		-e 'end run' "$prompt" "$ref" 2>/dev/null) || exit 0
	ref=$(printf '%s' "$ref" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')
	[[ -z $ref ]] && exit 0
	path=$(printf '%s' "$ref" | sed -E 's/(:[0-9]+){1,2}$//')
	[[ -e $path ]] && break
	prompt="Not found: $path"
done
exec /Applications/Zed.app/Contents/MacOS/cli --add "$ref"
