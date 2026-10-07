#!/usr/bin/env python3
"""Find the unit and table tests a Go change can delete, by mutation.

Each mutant runs the unit command with `-json` and no `-failfast`, so every test and
table row it fails is recorded. A mutant some candidate kills also runs the E2E command,
one at a time, when E2E executes its line. E2E tests are the reference: never judged.

Verdict per candidate (a test or a table row the caller names):
  KEEP        kills a mutant nothing else kills
  USELESS     covers a mutated line and kills no mutant
  E2E-COVERED every mutant it kills, E2E kills too
  REDUNDANT   every mutant it kills, a kept test kills too
  NO-VERDICT  covers no mutated line

Exit 0 = nothing to delete · 1 = a test to delete · 2 = usage, or a red baseline.
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

e2e_lock = threading.Lock()


def die(msg: str) -> None:
    print(f"go-test-worth: {msg}", file=sys.stderr)
    sys.exit(2)


def go_flags(cmd: str, *flags: str) -> str:
    if "go test" not in cmd:
        return cmd
    for f in flags:
        if f" {f.split('=')[0]}" not in cmd:
            cmd += f" {f}"
    return cmd


def run_pattern(test_id: str) -> str:
    return "/".join(f"^{re.escape(part)}$" for part in test_id.split("/"))


def sh(cmd: str, cwd: Path, timeout_s: int) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True,
                              timeout=timeout_s, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(cmd, 124, "", "timeout")


def test_events(stdout: str) -> tuple[set[str], set[str]]:
    failed, seen = set(), set()
    for line in stdout.splitlines():
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        name = ev.get("Test")
        if not name or ev.get("Action") not in ("pass", "fail"):
            continue
        seen.add(name)
        if ev["Action"] == "fail":
            failed.add(name)
    leaves = lambda names: {n for n in names if not any(o.startswith(n + "/") for o in names)}
    return leaves(failed), leaves(seen)


def covered_lines(profile: Path, checkout: Path) -> set[str]:
    lines: set[str] = set()
    if not profile.is_file():
        return lines
    for row in profile.read_text().splitlines()[1:]:
        m = re.match(r"(.+):(\d+)\.\d+,(\d+)\.\d+ \d+ (\d+)$", row)
        if not m or m.group(4) == "0":
            continue
        for n in range(int(m.group(2)), int(m.group(3)) + 1):
            lines.add(f"{m.group(1)}:{n}")
    return lines


def line_in(lines: set[str], file: str, line: str) -> bool:
    suffix = f"/{file.lstrip('./')}:{line}"
    return any(k.endswith(suffix) or k == f"{file}:{line}" for k in lines)


def coverage(cmd: str, checkout: Path, out: Path, timeout_s: int) -> set[str]:
    run = sh(go_flags(cmd, "-covermode=set", f"-coverprofile={out}"), checkout, timeout_s)
    if run.returncode != 0:
        die(f"the unmutated command fails, so no mutant can be judged: {cmd}\n"
            + "\n".join((run.stdout + run.stderr).splitlines()[:20]))
    return covered_lines(out, checkout)


def first_changed_line(before: str, after: str) -> int:
    a, b = before.splitlines(), after.splitlines()
    for i, (x, y) in enumerate(zip(a, b), start=1):
        if x != y:
            return i
    return min(len(a), len(b)) + 1


def main() -> int:
    ap = argparse.ArgumentParser(prog="go-test-worth.py", description=__doc__.splitlines()[0])
    ap.add_argument("--checkout", type=Path, required=True)
    ap.add_argument("--mutants", type=Path, required=True,
                    help="TAB lines: <label> <file>:<line> <perl-expr>")
    ap.add_argument("--unit", required=True, help="the go test command that runs the candidates")
    ap.add_argument("--candidates", type=Path, required=True,
                    help="one test id per line: TestName or TestName/row_name")
    ap.add_argument("--e2e", help="the E2E command; omit when the repo has none")
    ap.add_argument("-j", type=int, default=max(2, min(8, (os.cpu_count() or 4) // 2)))
    ap.add_argument("-t", type=int, default=120, help="seconds per unit run")
    ap.add_argument("--e2e-timeout", type=int, default=1800, help="seconds per E2E run")
    args = ap.parse_args()

    checkout = args.checkout.resolve()
    unit = go_flags(args.unit, "-json", f"-timeout={args.t}s")
    candidates = [l.strip() for l in args.candidates.read_text().splitlines() if l.strip()]
    mutants = []
    for row in args.mutants.read_text().splitlines():
        if not row.strip() or row.startswith("#"):
            continue
        label, target, expr = row.split("\t")[:3]
        file, _, line = target.partition(":")
        mutants.append((label, file, line, expr))
    if not mutants or not candidates:
        die("no mutant or no candidate")

    work = Path(tempfile.mkdtemp(prefix="test-worth."))
    try:
        base = sh(unit, checkout, args.t + 30)
        if base.returncode != 0:
            die(f"the unmutated unit command fails: {args.unit}\n"
                + "\n".join((base.stdout + base.stderr).splitlines()[:20]))
        _, all_tests = test_events(base.stdout)
        missing = [c for c in candidates if c not in all_tests]
        if missing:
            die(f"candidates the unit command does not run: {', '.join(missing)}")

        cand_cover = {c: coverage(go_flags(args.unit, f"-run='{run_pattern(c)}'"), checkout,
                                  work / f"c{i}.out", args.t + 30)
                      for i, c in enumerate(candidates)}
        any_cand = set().union(*cand_cover.values())
        e2e_cover = coverage(args.e2e, checkout, work / "e2e.out", args.e2e_timeout) if args.e2e else set()

        results: dict[str, dict] = {}

        def run_one(m, sandbox: Path) -> None:
            label, file, line, expr = m
            path = sandbox / file
            before = path.read_text()
            subprocess.run(["perl", "-0pi", "-e", expr, str(path)], check=False)
            after = path.read_text()
            try:
                if before == after:
                    results[label] = {"state": "no-op"}
                    return
                if line and str(first_changed_line(before, after)) != line:
                    results[label] = {"state": "misplaced"}
                    return
                if not line_in(any_cand, file, line):
                    results[label] = {"state": "uncovered"}
                    return
                run = sh(unit, sandbox, args.t + 30)
                if "[build failed]" in run.stdout + run.stderr or "setup failed" in run.stdout:
                    results[label] = {"state": "invalid"}
                    return
                killers, _ = test_events(run.stdout)
                if run.returncode == 124:
                    killers = killers or {"(timeout)"}
                e2e_kills = False
                if killers & set(candidates) and args.e2e and line_in(e2e_cover, file, line):
                    with e2e_lock:
                        e2e = sh(go_flags(args.e2e, "-failfast", f"-timeout={args.e2e_timeout}s"),
                                 sandbox, args.e2e_timeout + 60)
                    e2e_kills = e2e.returncode != 0
                results[label] = {"state": "ran", "killers": sorted(killers), "e2e": e2e_kills}
            finally:
                path.write_text(before)

        slices = [mutants[i::args.j] for i in range(args.j)]

        def worker(i: int, ms) -> None:
            sandbox = work / f"sb{i}"
            if subprocess.run(["cp", "-al", str(checkout), str(sandbox)]).returncode != 0:
                shutil.copytree(checkout, sandbox, symlinks=True)
            for m in ms:
                file = sandbox / m[1]
                os.unlink(file)
                shutil.copy2(checkout / m[1], file)
                run_one(m, sandbox)

        with cf.ThreadPoolExecutor(args.j) as pool:
            list(pool.map(lambda p: worker(*p), [(i, s) for i, s in enumerate(slices) if s]))

        mutated = {(m[1], m[2]) for m in mutants}
        kills = {c: {l for l, r in results.items() if c in r.get("killers", [])} for c in candidates}
        by_e2e = {l for l, r in results.items() if r.get("e2e")}
        reference = set()
        for r in results.values():
            reference |= set(r.get("killers", [])) - set(candidates)
        ref_kills = {l for l, r in results.items() if set(r.get("killers", [])) & reference}

        verdicts: dict[str, str] = {}
        open_kills = {}
        for c in candidates:
            if not any(line_in(cand_cover[c], f, l) for f, l in mutated):
                verdicts[c] = "NO-VERDICT\tcovers no mutated line"
            elif not kills[c]:
                verdicts[c] = "USELESS\tcovers mutated lines and kills no mutant"
            elif kills[c] <= by_e2e:
                verdicts[c] = "E2E-COVERED\tE2E kills " + ",".join(sorted(kills[c]))
            else:
                open_kills[c] = kills[c] - by_e2e
        covered = set(ref_kills)
        for c in sorted(open_kills, key=lambda c: (-len(open_kills[c] - covered), c)):
            unique = open_kills[c] - covered
            if unique:
                verdicts[c] = "KEEP\tonly it kills " + ",".join(sorted(unique))
                covered |= open_kills[c]
            else:
                verdicts[c] = "REDUNDANT\tkept tests and E2E kill " + ",".join(sorted(open_kills[c]))

        for label, r in sorted(results.items()):
            print(f"MUTANT\t{label}\t{r['state']}\t{','.join(r.get('killers', [])) or '-'}\te2e={'yes' if r.get('e2e') else 'no'}")
        for c in candidates:
            print(f"TEST\t{c}\t{verdicts[c]}")
        delete = [c for c in candidates if verdicts[c].split('\t')[0] in ("USELESS", "E2E-COVERED", "REDUNDANT")]
        print(f"\nmutants={len(mutants)} candidates={len(candidates)} delete={len(delete)}")
        return 1 if delete else 0
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
