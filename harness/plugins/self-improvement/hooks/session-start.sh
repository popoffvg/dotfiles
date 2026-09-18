#!/usr/bin/env bash
# SessionStart hook (self-improvement plugin): kick one detached scan and return.
#
# This is the plugin's entire scheduler. Not a daemon and not a timer — the
# trigger is an event that already happens on every machine Claude Code runs on,
# so there is no LaunchAgent to install on macOS, no systemd unit on Linux, no
# process to supervise anywhere, and nothing to restart after a reboot or an
# upgrade. The scan is idempotent and watermarked, so it does not matter *when*
# it runs, only that it runs eventually.
#
# What it scores is the session you just left: the scan skips any transcript
# written to inside the idle window, so the pass that starts with this session
# picks up the previous one, finished and quiet.
#
# Stdout is the one thing this hook does say to the model. A SessionStart hook's
# stdout becomes context in the session that fired it, which is the only channel
# that reaches the user at the moment they are able to act: the scan that found a
# suggestion ran detached, hours earlier, with no session open to speak into.
# inbox-read.mjs prints the entries no session has shown yet, and prints nothing
# at all when there are none — the common case.
set -euo pipefail

# Inside the scoring child, whose own SessionStart would kick another scan.
[ -n "${SELF_IMPROVE_CHILD:-}" ] && exit 0

plugin_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# Before the scan is launched, so a session never announces what its own scan is
# about to write — those entries belong to the session that starts next.
command -v node >/dev/null 2>&1 && node "$plugin_root/scripts/inbox-read.mjs" 2>/dev/null || true

# nohup + background, because macOS has no setsid. All three fds are redirected:
# an inherited stdout would be read back as this hook's output, and an inherited
# stdin would steal the hook's payload.
nohup "$plugin_root/scripts/scan.sh" </dev/null >/dev/null 2>&1 &
disown 2>/dev/null || true
exit 0
