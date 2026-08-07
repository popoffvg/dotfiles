#!/usr/bin/env bash
# Verify a yazi [open] rule fires for a given file: runs yazi in a pty against a
# throwaway file, presses Enter (open) then q (quit), and prints the probe result.
#
# Usage: yazi-opener-probe.sh <config-home> <test-filename> <probe-file>
#   <config-home>   dir holding a yazi.toml whose opener writes to <probe-file>
#   <test-filename> file to create and open, e.g. note.md
#   <probe-file>    file the opener is configured to write
set -euo pipefail

config_home=$1
test_filename=$2
probe_file=$3

work_dir=$(dirname "$probe_file")/work
rm -rf "$work_dir" "$probe_file"
mkdir -p "$work_dir"
printf '# heading\n\ntext\n' > "$work_dir/$test_filename"

# script(1) gives yazi the pty it refuses to start without. The sleeps matter:
# bytes written before yazi enters raw mode are discarded, so each keystroke
# waits for the TUI to settle. Keys: Enter (trigger the open rule), then q.
YAZI_CONFIG_HOME="$config_home" \
	script -q /dev/null yazi "$work_dir" \
	< <(sleep 3; printf '\r'; sleep 3; printf 'q'; sleep 1) > /dev/null 2>&1 || true

if [[ -f $probe_file ]]; then
	echo "PROBE FIRED: $(cat "$probe_file")"
else
	echo "PROBE DID NOT FIRE"
	exit 1
fi
