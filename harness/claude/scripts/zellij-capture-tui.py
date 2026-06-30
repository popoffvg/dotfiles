#!/usr/bin/env python3
"""Drive a TUI inside a zellij session and dump the screen after each step.

Allocates a real pty for the zellij server (works headless, where `script`
fails), then issues `zellij action` client commands over IPC to type keys and
dump frames. Frames are saved with ANSI styling (-a) so colors survive.

Usage: zellij-capture-tui.py <binary> <outdir>
Edit STEPS for a different TUI. Key bytes: enter=13, down="27 91 66".
"""
import os, sys, pty, time, struct, fcntl, termios, subprocess, threading, shutil

BIN, OUT = sys.argv[1], sys.argv[2]
SESSION = f"tuicap{os.getpid()}"
COLS, ROWS = 100, 40

LAYOUT = f"/tmp/{SESSION}.kdl"
open(LAYOUT, "w").write(f'layout {{\n  pane command="{BIN}"\n}}\n')

if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)

# pty for the attached zellij session.
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", ROWS, COLS, 0, 0))

env = dict(os.environ, PLATFORMA_TUI_DRYRUN="1", PLATFORMA_TUI_NOALT="1", TERM="xterm-256color")
# -n (not -l/--session-only) reliably starts a NEW session headless; -l alone
# routes to attach and exits 1 ("There is no active session!").
proc = subprocess.Popen(
    ["zellij", "-s", SESSION, "-n", LAYOUT],
    stdin=slave, stdout=slave, stderr=slave,
    start_new_session=True, env=env,
)
os.close(slave)

# Drain master so the server never blocks on a full pty buffer.
def drain():
    while True:
        try:
            if not os.read(master, 4096):
                break
        except OSError:
            break
threading.Thread(target=drain, daemon=True).start()

def z(*args):
    return subprocess.run(["zellij", "-s", SESSION, *args],
                          capture_output=True, text=True)

def cleanup():
    subprocess.run(["zellij", "kill-session", SESSION], capture_output=True)
    proc.terminate()

try:
    # Wait for the session to register.
    for _ in range(40):
        out = subprocess.run(["zellij", "list-sessions", "-n"], capture_output=True, text=True).stdout
        if SESSION in out:
            break
        time.sleep(0.3)
    else:
        print("session never came up", file=sys.stderr); cleanup(); sys.exit(1)
    time.sleep(2.0)  # first paint

    n = [0]
    def dump(name):
        z("action", "dump-screen", "-a", "--path", f"{OUT}/{n[0]:02d}-{name}.txt")
        n[0] += 1
        time.sleep(0.5)
    def key(*b):
        z("action", "write", *[str(x) for x in b]); time.sleep(0.6)
    def text(s):
        z("action", "write-chars", s); time.sleep(0.4)

    ENTER = (13,); DOWN = (27, 91, 66)

    dump("welcome")
    key(*ENTER);                  dump("project")
    text("my-lab-platforma"); key(*ENTER); dump("deployment-name")
    key(*ENTER);                  dump("region")
    key(*DOWN); key(*ENTER);      dump("size")
    key(*ENTER);                  dump("domain")
    text("mylab.bio"); key(*ENTER);   dump("dns-zone-name")
    text("mylab-bio"); key(*ENTER);   dump("subdomain")
    text("platforma"); key(*ENTER);   dump("license")
    text("E-DEMO-KEY"); key(*ENTER);  dump("contact-email")
    text("ops@mylab.bio"); key(*ENTER); dump("auth-method")
    key(*ENTER);                  dump("demo")
    key(*ENTER);                  dump("review")
    print(f"captured {n[0]} frames to {OUT}")
finally:
    cleanup()
