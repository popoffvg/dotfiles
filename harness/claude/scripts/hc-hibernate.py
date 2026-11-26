#!/usr/bin/env python3
"""Stop idle Claude Code sessions in Herdr Core terminals, and resume them on Enter.

A hibernated terminal keeps its shell, with `claude --resume <session>` typed at the
prompt, and the label `claude.hibernated=<session>`. Press Enter in it, or run `wake`.

usage: hc-hibernate.py sweep [<terminal>...] [--idle-minutes N] [--dry-run]
       hc-hibernate.py watch [--idle-minutes N]
       hc-hibernate.py wake (<terminal>... | --all)

Run it outside the command sandbox: it reads every process and the hc socket.
"""
import argparse
import json
import shlex
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

IDLE_STATUSES = {"idle", "done"}
HIBERNATED_LABEL = "claude.hibernated"
# The claude pid that did not exit after /exit, for example at a feedback-draft prompt; a second Enter there opens the draft.
EXIT_BLOCKED_LABEL = "claude.exit-blocked"
SESSION_FILES = Path.home() / ".claude" / "sessions"
BASH_TOOL_MARKER = "/.claude/shell-snapshots/"
WATCH_PERIOD_SECONDS = 300
EXIT_TIMEOUT_SECONDS = 30


@dataclass
class ClaudeSession:
    pid: int
    session_id: str
    terminal: str


def main() -> None:
    args = parse_args()
    if args.command == "sweep":
        sweep(args.terminals, args.idle_minutes, args.dry_run)
    elif args.command == "watch":
        while True:
            sweep([], args.idle_minutes, dry_run=False)
            time.sleep(WATCH_PERIOD_SECONDS)
    else:
        wake(args.terminals, args.all)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("sweep", "watch"):
        command = commands.add_parser(name)
        command.add_argument("--idle-minutes", type=float, default=60)
    commands.choices["sweep"].add_argument("terminals", nargs="*")
    commands.choices["sweep"].add_argument("--dry-run", action="store_true")
    wake_command = commands.add_parser("wake")
    wake_command.add_argument("terminals", nargs="*")
    wake_command.add_argument("--all", action="store_true")
    return parser.parse_args()


def sweep(addresses: list[str], idle_minutes: float, dry_run: bool) -> None:
    processes = read_processes()
    sessions = {s.terminal: s for s in find_claude_sessions(processes)}
    now_ms = time.time() * 1000
    for terminal in list_terminals():
        address = terminal["address"]
        if addresses and address not in addresses:
            continue
        session = sessions.get(address)
        if terminal.get("agent") != "claude-code" or terminal.get("status") not in IDLE_STATUSES or session is None:
            continue
        details = hc_json("get", address)
        idle_minutes_now = (now_ms - details["status_ms"]) / 60000
        if idle_minutes_now < idle_minutes:
            continue
        if details["labels"].get(EXIT_BLOCKED_LABEL) == str(session.pid):
            continue
        if runs_bash_tool(session.pid, processes):
            print(f"skip {address}: a Bash tool or background task still runs")
            continue
        print(f"hibernate {address} session {session.session_id} idle {idle_minutes_now:.0f} min")
        if not dry_run:
            hibernate(address, session, details["title"])


def wake(addresses: list[str], wake_all: bool) -> None:
    if wake_all:
        addresses = [t["address"] for t in list_terminals() if HIBERNATED_LABEL in hc_json("get", t["address"])["labels"]]
    running = {s.terminal for s in find_claude_sessions(read_processes())}
    for address in addresses:
        session_id = hc_json("get", address)["labels"].get(HIBERNATED_LABEL)
        if session_id is None:
            print(f"skip {address}: not hibernated")
            continue
        if address not in running:
            hc("keys", address, "ctrl+u")
            hc("send", address, f"claude --resume {session_id}")
        hc("label", address, f"{HIBERNATED_LABEL}=")
        print(f"wake {address} session {session_id}")


def hibernate(address: str, session: ClaudeSession, title: str) -> None:
    hc("send", address, "/exit")
    if not wait_for_exit(session.pid):
        hc("label", address, f"{EXIT_BLOCKED_LABEL}={session.pid}")
        print(f"skip {address}: claude pid {session.pid} still runs {EXIT_TIMEOUT_SECONDS} s after /exit")
        return
    hc("label", address, f"{HIBERNATED_LABEL}={session.session_id}")
    set_title = f"printf '\\e]0;%s\\a' {shlex.quote(title)}; " if title else ""
    hc("send", address, f" clear; {set_title}echo 'Claude hibernated. Press Enter to resume.'; print -z 'claude --resume {session.session_id}'")


def wait_for_exit(pid: int) -> bool:
    deadline = time.time() + EXIT_TIMEOUT_SECONDS
    while time.time() < deadline:
        if pid not in read_processes():
            return True
        time.sleep(1)
    return False


def list_terminals() -> list[dict]:
    return [t for t in hc_json("ls")["terminals"] if t["state"] == "live"]


def find_claude_sessions(processes: dict[int, tuple[int, str]]) -> list[ClaudeSession]:
    terminal_by_pid = {hc_json("get", t["address"])["pid"]: t["address"] for t in list_terminals()}
    sessions = []
    for path in SESSION_FILES.glob("*.json"):
        record = json.loads(path.read_text())
        if record.get("kind") != "interactive" or record["pid"] not in processes:
            continue
        terminal = find_terminal(record["pid"], processes, terminal_by_pid)
        if terminal is not None:
            sessions.append(ClaudeSession(record["pid"], record["sessionId"], terminal))
    return sessions


def find_terminal(pid: int, processes: dict[int, tuple[int, str]], terminal_by_pid: dict[int, str]) -> str | None:
    while pid in processes and pid not in terminal_by_pid:
        pid = processes[pid][0]
    return terminal_by_pid.get(pid)


def runs_bash_tool(claude_pid: int, processes: dict[int, tuple[int, str]]) -> bool:
    return any(BASH_TOOL_MARKER in command and claude_pid in ancestors(pid, processes) for pid, (_, command) in processes.items())


def ancestors(pid: int, processes: dict[int, tuple[int, str]]) -> set[int]:
    found = set()
    while pid in processes and pid > 1:
        pid = processes[pid][0]
        found.add(pid)
    return found


def read_processes() -> dict[int, tuple[int, str]]:
    output = subprocess.run(["ps", "-axo", "pid=,ppid=,command="], capture_output=True, text=True, check=True).stdout
    processes = {}
    for line in output.splitlines():
        fields = line.split(None, 2)
        command = fields[2] if len(fields) == 3 else ""
        processes[int(fields[0])] = (int(fields[1]), command)
    return processes


def hc_json(*args: str) -> dict:
    return json.loads(hc(*args, "--json"))


def hc(*args: str) -> str:
    result = subprocess.run(["hc", *args], capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"hc {' '.join(args)}: {result.stderr.strip() or result.stdout.strip()}")
    return result.stdout


if __name__ == "__main__":
    main()
