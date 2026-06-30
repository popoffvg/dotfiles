#!/usr/bin/env python3
"""Drive a TUI binary in a pty, snapshot the screen after each keystroke.

Works fully headless (no controlling tty needed) where `script`/zellij can't
dump. Includes a tiny ANSI screen model (enough for bubbletea's renderer) so
each snapshot is the clean visible screen, not a stream of repaints.

Usage: pty-capture-tui.py <binary> <outdir>
Run the target with PLATFORMA_TUI_NOALT=1 so it renders to the primary buffer.
"""
import os, sys, pty, time, struct, fcntl, termios, codecs, unicodedata

BIN, OUT = sys.argv[1], sys.argv[2]
COLS, ROWS = 100, 44
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith(".txt"):
        os.remove(os.path.join(OUT, f))


class Screen:
    """Minimal CSI/printable interpreter: enough for a redrawing TUI."""
    def __init__(self):
        self.g = {}            # (row,col) -> char
        self.r = self.c = 0

    def width(self, ch):
        return 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1

    def feed(self, data):
        i, n = 0, len(data)
        while i < n:
            ch = data[i]
            if ch == "\x1b":
                if i + 1 < n and data[i+1] == "[":
                    j = i + 2
                    while j < n and not data[j].isalpha():
                        j += 1
                    params, cmd = data[i+2:j], data[j:j+1]
                    self.csi(params, cmd)
                    i = j + 1
                    continue
                if i + 1 < n and data[i+1] == "]":   # OSC ... BEL/ST
                    j = i + 2
                    while j < n and data[j] not in ("\x07", "\x1b"):
                        j += 1
                    i = j + (2 if j < n and data[j] == "\x1b" else 1)
                    continue
                i += 1
                continue
            if ch == "\r":
                self.c = 0
            elif ch == "\n":
                self.r += 1
                self.c = 0
            elif ch == "\b":
                self.c = max(0, self.c - 1)
            elif ch >= " ":
                self.g[(self.r, self.c)] = ch
                self.c += self.width(ch)
            i += 1

    def csi(self, params, cmd):
        nums = [int(p) for p in params.split(";") if p.isdigit()]
        a = nums[0] if nums else 0
        if cmd == "A": self.r = max(0, self.r - max(1, a))
        elif cmd == "B": self.r += max(1, a)
        elif cmd == "C": self.c += max(1, a)
        elif cmd == "D": self.c = max(0, self.c - max(1, a))
        elif cmd in ("H", "f"):
            self.r = (nums[0] - 1) if len(nums) >= 1 else 0
            self.c = (nums[1] - 1) if len(nums) >= 2 else 0
        elif cmd == "J":
            if a == 2 or a == 3:
                self.g.clear()
            else:  # 0: clear to end of screen
                for (r, c) in list(self.g):
                    if r > self.r or (r == self.r and c >= self.c):
                        del self.g[(r, c)]
        elif cmd == "K":
            for (r, c) in list(self.g):
                if r == self.r and (a == 2 or c >= self.c):
                    del self.g[(r, c)]

    def render(self):
        if not self.g:
            return ""
        maxr = max(r for r, _ in self.g)
        out = []
        for r in range(maxr + 1):
            cols = [c for (rr, c) in self.g if rr == r]
            if not cols:
                out.append("")
                continue
            line = "".join(self.g.get((r, c), " ") for c in range(max(cols) + 1))
            out.append(line.rstrip())
        return "\n".join(out).rstrip("\n")


master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", ROWS, COLS, 0, 0))
pid = os.fork()
if pid == 0:
    os.setsid()
    fcntl.ioctl(slave, termios.TIOCSCTTY, 0)
    os.dup2(slave, 0); os.dup2(slave, 1); os.dup2(slave, 2)
    os.environ.update(PLATFORMA_TUI_DRYRUN="1", PLATFORMA_TUI_NOALT="1", TERM="xterm-256color")
    os.execv(BIN, [BIN])
os.close(slave)

screen = Screen()
os.set_blocking(master, False)
_decoder = codecs.getincrementaldecoder("utf-8")("replace")


def pump(seconds):
    end = time.time() + seconds
    while time.time() < end:
        try:
            d = os.read(master, 65536)
            if d:
                screen.feed(_decoder.decode(d))  # incremental: handles split multibyte chars
        except (OSError, BlockingIOError):
            pass
        time.sleep(0.02)


def send(s):
    os.write(master, s)
    pump(0.7)


n = [0]
def snap(name):
    path = os.path.join(OUT, f"{n[0]:02d}-{name}.txt")
    open(path, "w").write(screen.render())
    n[0] += 1


ENTER = b"\r"; DOWN = b"\x1b[B"

pump(1.5);                       snap("welcome")
send(ENTER);                     snap("project")
send(b"my-lab-platforma"); send(ENTER); snap("deployment-name")
send(ENTER);                     snap("region")
send(DOWN); send(ENTER);         snap("size")
send(ENTER);                     snap("domain")
send(b"mylab.bio"); send(ENTER); snap("dns-zone-name")
send(b"mylab-bio"); send(ENTER); snap("subdomain")
send(b"platforma"); send(ENTER); snap("license")
send(b"E-DEMO-KEY"); send(ENTER); snap("contact-email")
send(b"ops@mylab.bio"); send(ENTER); snap("auth-method")
send(ENTER);                     snap("demo")
send(ENTER);                     snap("review")
print(f"captured {n[0]} frames to {OUT}")
try: os.kill(pid, 9)
except OSError: pass
