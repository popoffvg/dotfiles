#!/usr/bin/env python3
"""Capture yazi's drawn screen and assert what the preview pane rendered.

The sibling yazi-opener-probe.sh checks an opener by its side effect (a file the
opener writes), so it never needs the screen. A previewer has no side effect --
the only evidence is the pixels. `script -q /dev/null yazi` cannot supply them:
its pty inherits no window size, so yazi computes a zero-area preview and draws
nothing. This spawns yazi on a pty with an explicit TIOCSWINSZ instead.

Usage:
  yazi-preview-probe.py <dir> [--expect REGEX]... [--reject REGEX]...
                        [--cols N] [--rows N] [--wait SEC] [--show]

  <dir>       directory to open; yazi selects its first entry, so keep one file
  --expect    regex that MUST appear in the screen text (repeatable)
  --reject    regex that must NOT appear, e.g. raw markup the renderer replaces
  --show      print the stripped screen text

Exit 0 when every --expect matched and no --reject did, else 1.
"""

import argparse
import fcntl
import os
import pty
import re
import select
import signal
import struct
import subprocess
import sys
import termios
import time

# yazi asks the terminal for its capabilities and blocks on the reply. A bare pty
# answers nothing, so each query burns its own timeout before yazi draws. Replying
# to the two it sends (primary device attributes, background color) skips that.
QUERY_REPLIES = ((b"\x1b[0c", b"\x1b[?6c"), (b"\x1b]11;?", b"\x1b]11;rgb:1e/1e/2e\x07"))

ANSI = re.compile(rb"\x1b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|P[^\x1b]*\x1b\\|[()][A-Za-z0-9]|[=><78])")


def capture(directory, cols, rows, wait):
    """Run yazi on a sized pty, return every byte it drew."""
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))

    env = dict(os.environ, TERM="xterm-256color", COLUMNS=str(cols), LINES=str(rows))
    # start_new_session makes the slave yazi's controlling terminal.
    proc = subprocess.Popen(
        ["yazi", directory],
        stdin=slave, stdout=slave, stderr=slave,
        env=env, start_new_session=True,
    )
    os.close(slave)

    chunks, deadline, quit_sent = [], time.monotonic() + wait, False
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            if quit_sent:
                break
            os.write(master, b"q")  # let yazi tear down its alternate screen
            quit_sent, deadline = True, time.monotonic() + 1.5
            continue
        if not select.select([master], [], [], min(remaining, 0.2))[0]:
            continue
        try:
            data = os.read(master, 65536)
        except OSError:
            break
        if not data:
            break
        chunks.append(data)
        for query, reply in QUERY_REPLIES:
            if query in data:
                os.write(master, reply)

    os.close(master)
    if proc.poll() is None:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    proc.wait()
    return b"".join(chunks)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("directory")
    ap.add_argument("--expect", action="append", default=[])
    ap.add_argument("--reject", action="append", default=[])
    ap.add_argument("--cols", type=int, default=140)
    ap.add_argument("--rows", type=int, default=40)
    ap.add_argument("--wait", type=float, default=8.0)
    ap.add_argument("--show", action="store_true")
    args = ap.parse_args()

    screen = ANSI.sub(b"", capture(args.directory, args.cols, args.rows, args.wait))
    text = screen.decode("utf-8", "replace")

    if args.show:
        print(text)
        print("-" * 60)

    ok = True
    for pattern in args.expect:
        hit = re.search(pattern, text) is not None
        print(f"{'FOUND   ' if hit else 'MISSING '} expect /{pattern}/")
        ok &= hit
    for pattern in args.reject:
        hit = re.search(pattern, text) is not None
        print(f"{'PRESENT ' if hit else 'ABSENT  '} reject /{pattern}/")
        ok &= not hit

    if not args.expect and not args.reject:
        print(f"captured {len(text)} chars of screen text; pass --expect to assert")
        return 0
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
