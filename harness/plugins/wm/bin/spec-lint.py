#!/usr/bin/env python3
"""Run every countable `/code verify` Phase 0 check over one wm notes dir, in one call.

`code:sub-verify.md` § Phase 0 lists the checks a spec must pass before the adversarial
fan-out is worth paying for. Most of them are field inspection - a heading missing, a
frontmatter key out of range, an increment number skipped, an Autotest level left empty.
A driver that reads the corpus and judges those by hand pays the whole corpus in context
and answers differently on two runs. This script is the same rules, parsed.

What stays for the agents: self-containment, over-statement, a body hiding in a Surface
diff, and the three hunts (contradictions, missing parts, edge cases). Those are
judgments, and no parser reaches them.

Every check prints its verdict, pass or fail, so a clean run proves the check ran - the
same rule the review gates' `Covered` table follows.

usage: spec-lint.py <notes-dir> [--json] [--quiet]
exit 0 every check passed - 1 at least one finding - 2 unusable notes dir
Tool index — every .notes tool and its flags: wm:TOOLS.md
"""
import json
import os
import re
import subprocess
import sys

BRICKS = {
    "command", "service", "flow", "gateway",
    "server", "consumer", "policy", "scheduler", "wiring",
}
TOUCHES = {"create", "modify", "delete"}
TYPES = {
    "new behavior", "signature change", "wiring", "call-site migration",
    "rename", "move", "deletion", "test", "generated",
}
APPROVALS = {"inherit", "increment", "todo", "none"}
MAX_INCREMENTS = 10

HUMAN_ORDER = ["Outcome", "Components", "Surface", "Autotest", "Commit"]
AGENT_ORDER = [
    "Constraints", "Changes", "Files",
    "Pre-reads (MUST read before editing)", "Manual test", "Definition of done",
]
SPEC_BANNED = ["Design Decisions", "Open Questions", "Implementation Guidelines"]

# A skip or a `none` level that names no concrete reason. Lowercased substring match.
EMPTY_REASONS = [
    "covered by the unit test", "covered by unit test", "covered by unit tests",
    "covered by autotest", "covered by tests", "covered by existing tests",
    "no manual step needed", "trivial", "no e2e harness", "will add later",
    "not needed", "n/a",
]
VAGUE_BLAST = {"low", "minimal", "none", "small", "n/a", "trivial"}

H1 = re.compile(r"^# +(.+?)\s*$")
H2 = re.compile(r"^## +(.+?)\s*$")
H3 = re.compile(r"^### +(.+?)\s*$")
INCREMENT = re.compile(r"^### +(\d+)\. +(.+?)\s*$")
BULLET_KEY = re.compile(r"^\s*[-*]\s*\*\*([^:*]+):?\*\*:?\s*(.*)$")
LEVEL = re.compile(r"^\s*[-*]?\s*\*\*?(Unit|E2E)\*?\*?:?\s*(.*)$", re.IGNORECASE)
TABLE_ROW = re.compile(r"^\s*\|(.+)\|\s*$")
TABLE_RULE = re.compile(r"^\s*\|[\s:|-]+\|?\s*$")
TODO_REF = re.compile(r"\bTODO-(\d+)\b")
PROGRESS = re.compile(r"^(\d+)\s*/\s*(\d+)$")
CODE_CALL = re.compile(r"`[A-Za-z_][\w.]*\([^`]*\)`")
LANDED = re.compile(r"^\s*[`*]*(yes|no)\b", re.IGNORECASE)


def table_header(lines):
    for line in lines:
        m = TABLE_ROW.match(line)
        if m and not TABLE_RULE.match(line):
            return [c.strip() for c in m.group(1).split("|")]
    return []


def ledger_rows(notes):
    """The TODO numbers spec.md's ledger declares — None when it has no ledger."""
    lines = read(os.path.join(notes, "spec.md"))
    if lines is None:
        return None
    found = {int(m.group(1)) for m in
             (re.match(r"^#{3,4} +TODO-(\d+)\b", l) for l in lines) if m}
    if not found:
        found = {int(m.group(1)) for m in
                 (re.match(r"^\s*\|\s*\**TODO-(\d+)", l) for l in lines) if m}
    return found or None


def pastes_code(text):
    """A Do that pastes a declaration, not one that names a call in a sentence."""
    if "```" in text:
        return True
    for snippet in re.findall(r"`([^`]+)`", text):
        if re.search(r"\b(func|def|fn|class|interface|type)\s+\w+", snippet):
            return True
    return False


class Findings:
    """Every check registers here — a pass leaves a row too."""

    def __init__(self):
        self.checks = []

    def check(self, cid, title):
        row = {"id": cid, "title": title, "findings": []}
        self.checks.append(row)
        return row

    def fail(self, row, where, message, remedy=""):
        row["findings"].append({"where": where, "message": message, "remedy": remedy})

    @property
    def failed(self):
        return [c for c in self.checks if c["findings"]]


def read(path):
    try:
        return open(path, encoding="utf-8", errors="replace").read().splitlines()
    except OSError:
        return None


def frontmatter(lines):
    if not lines or lines[0].strip() != "---":
        return {}, lines
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            body = lines[i + 1:]
            fm = {}
            for line in lines[1:i]:
                if ":" in line:
                    k, _, v = line.partition(":")
                    fm[k.strip()] = v.strip()
            return fm, body
    return {}, lines


def headings(lines, pattern=H2):
    """[(lineno, title)] — outside fenced code."""
    out, fenced = [], False
    for n, line in enumerate(lines, 1):
        if line.lstrip().startswith("```"):
            fenced = not fenced
            continue
        if fenced:
            continue
        m = pattern.match(line)
        if m:
            out.append((n, m.group(1).strip()))
    return out


def section(lines, name):
    """The body lines under `## name`, up to the next H2."""
    out, inside, fenced = [], False, False
    for line in lines:
        if line.lstrip().startswith("```"):
            fenced = not fenced
            if inside:
                out.append(line)
            continue
        if not fenced:
            m = H2.match(line)
            if m:
                inside = m.group(1).strip() == name
                continue
        if inside:
            out.append(line)
    return out


def table_rows(lines):
    """Body rows of the first markdown table in `lines`, each a list of cells."""
    rows, seen_rule = [], False
    for line in lines:
        if TABLE_RULE.match(line):
            seen_rule = True
            continue
        m = TABLE_ROW.match(line)
        if not m:
            if rows and seen_rule:
                break
            continue
        cells = [c.strip() for c in m.group(1).split("|")]
        if seen_rule:
            rows.append(cells)
    return rows


def has_reason(text):
    body = text.split("—", 1)[-1] if "—" in text else text
    body = body.split("-", 1)[-1] if body is text and "-" in text else body
    body = body.strip(" .:")
    if len(body) < 12:
        return False
    low = body.lower()
    return not any(bad in low for bad in EMPTY_REASONS)


# ---------------------------------------------------------------- corpus

def todo_pairs(notes):
    todos = os.path.join(notes, "todos")
    root = todos if os.path.isdir(todos) else notes
    pairs = {}
    for name in sorted(os.listdir(root)):
        m = re.fullmatch(r"TODO-(\d+)(\.agent)?\.md", name)
        if not m:
            continue
        n = int(m.group(1))
        slot = "agent" if m.group(2) else "human"
        pairs.setdefault(n, {})[slot] = os.path.join(root, name)
    return pairs


# ---------------------------------------------------------------- checks

def check_budgets(notes, f):
    row = f.check("A1", "budgets and misplaced sections (budget-sweep.sh)")
    root = os.environ.get("CLAUDE_PLUGIN_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sweep = os.path.join(root, "bin", "budget-sweep.sh")
    if not os.path.isfile(sweep):
        f.fail(row, sweep, "budget-sweep.sh not found", "check CLAUDE_PLUGIN_ROOT")
        return
    proc = subprocess.run([sweep, notes], capture_output=True, text=True)
    if proc.returncode != 0:
        for line in (proc.stdout + proc.stderr).splitlines():
            if line.strip():
                f.fail(row, notes, line.strip())


def check_rules(notes, f):
    row = f.check("A2", "every rule note carries a known status and its text (wm-constraints.py --check)")
    script = os.path.expanduser("~/.claude/scripts/wm-constraints.py")
    thoughts = os.path.join(notes, "thoughts")
    if not os.path.isfile(script) or not os.path.isdir(thoughts):
        row["skipped"] = "no thoughts/ graph" if not os.path.isdir(thoughts) else "wm-constraints.py absent"
        return
    proc = subprocess.run(["python3", script, thoughts, "--check"], capture_output=True, text=True)
    if proc.returncode == 3:
        fixes = {
            "is not one of": "set status to one of proposed, open, approved, declined",
            "status: proposed": "get the human to agree it, then set status: approved — or decline it with the reason",
        }
        for line in proc.stdout.splitlines():
            line = line.strip()
            if not line or line.startswith("---"):
                continue
            fix = next((v for k, v in fixes.items() if k in line), "give the note a frontmatter description")
            f.fail(row, thoughts, line, fix)


def check_open_questions(notes, f):
    row = f.check("A3", "no open question note")
    thoughts = os.path.join(notes, "thoughts")
    if not os.path.isdir(thoughts):
        row["skipped"] = "no thoughts/ graph"
        return
    for name in sorted(os.listdir(thoughts)):
        if not name.endswith(".md"):
            continue
        lines = read(os.path.join(thoughts, name)) or []
        fm, _ = frontmatter(lines)
        if fm.get("type") == "question" and fm.get("status") == "open":
            f.fail(row, name, "open question", "settle it and record the decision, or close the note")


def check_spec(notes, pairs, f):
    path = os.path.join(notes, "spec.md")
    lines = read(path)
    row = f.check("A4", "spec.md carries no section that belongs elsewhere")
    if lines is None:
        f.fail(row, path, "spec.md missing", "write the spec before verifying it")
        return
    for _, title in headings(lines):
        if title in SPEC_BANNED:
            f.fail(row, f"spec.md § {title}",
                   "section belongs outside spec.md",
                   "decisions → thoughts/, patterns → PATTERNS.md")

    row = f.check("A5", "spec.md `approve` is a level impl can read")
    fm, _ = frontmatter(lines)
    if "approve" in fm:
        value = fm["approve"].split("—")[0].split("#")[0].strip()
        if value == "inherit":
            f.fail(row, "spec.md", "approve `inherit` on the spec",
                   "the spec is the level with nothing to inherit from — increment, todo, or none")
        elif value not in APPROVALS:
            f.fail(row, "spec.md", f"approve `{value}` outside {sorted(APPROVALS - {'inherit'})}",
                   "pick one")

    plan = f.check("B2", "the wave plan covers every ledger row exactly once")
    body = section(lines, "Plan")
    if not body:
        f.fail(plan, "spec.md § Plan", "no ## Plan section", "add the wave table")
        return
    placed = {}
    header = next((cells for cells in [table_header(body)] if cells), [])
    col = next((i for i, h in enumerate(header) if "todo" in h.lower()), 1)
    for cells in table_rows(body):
        if len(cells) <= col:
            continue
        wave = cells[0]
        for n in {int(x) for x in TODO_REF.findall(cells[col])}:
            placed.setdefault(n, []).append(wave)
    for n in sorted(pairs):
        waves = placed.get(n, [])
        if not waves:
            f.fail(plan, f"TODO-{n}", "in no wave", "add it to the wave table")
        elif len(set(waves)) > 1:
            f.fail(plan, f"TODO-{n}", f"in {len(set(waves))} waves: {', '.join(sorted(set(waves)))}",
                   "one wave per row")


def check_glossary(notes, pairs, f):
    """The naming gate reads Status; a glossary without it re-litigates every existing name."""
    row = f.check("G1", "GLOSSARY.md marks every term `existing` or `new`")
    path = os.path.join(notes, "GLOSSARY.md")
    lines = read(path)
    if lines is None:
        row["skipped"] = "no GLOSSARY.md"
        return
    header = table_header(lines)
    cols = [h.lower() for h in header]
    if "status" not in cols:
        f.fail(row, "GLOSSARY.md", "table has no Status column",
               "add `Status` — `existing` | `new` (arch:examples/glossary.md)")
        return
    at = cols.index("status")
    term_at = cols.index("term") if "term" in cols else 0
    minted = set()
    for cells in table_rows(lines):
        if len(cells) <= at:
            continue
        status = cells[at].strip().lower()
        term = cells[term_at].strip(" `*")
        if status not in ("existing", "new"):
            f.fail(row, f"GLOSSARY.md § {term}", f"Status `{cells[at]}` is neither existing nor new",
                   "the naming gate judges the new rows alone")
        elif status == "new":
            minted.add(term)

    declared = f.check("G2", "every `## New terms` row reaches GLOSSARY.md as `new`")
    for n in sorted(pairs):
        human = pairs[n].get("human")
        if not human:
            continue
        for cells in table_rows(section(read(human) or [], "New terms")):
            term = cells[0].strip(" `*")
            if term and term not in minted:
                f.fail(declared, f"TODO-{n} § New terms",
                       f"`{term}` is not a `new` row in GLOSSARY.md",
                       "the caller merges every New terms row into the glossary")


def check_pairs_exist(notes, pairs, f):
    row = f.check("B1", "every ledger row is a pair on disk, and every pair a ledger row")
    if not pairs:
        f.fail(row, notes, "no TODO-N.md found", "write the ledger rows")
        return
    for n in sorted(pairs):
        if "human" not in pairs[n]:
            f.fail(row, f"TODO-{n}", "agent half with no human half", "the work nobody approved")
        if "agent" not in pairs[n]:
            f.fail(row, f"TODO-{n}", "human half with no agent half", "unimplementable as written")
    ledger = ledger_rows(notes)
    if ledger is None:
        return
    for missing in sorted(ledger - set(pairs)):
        f.fail(row, f"TODO-{missing}", "ledger row with no pair on disk", "write the pair, or drop the row")
    for extra in sorted(set(pairs) - ledger):
        f.fail(row, f"TODO-{extra}", "pair on disk with no ledger row", "add the row, or delete the pair")


def check_human(n, path, lines, pairs, f, checks):
    where = os.path.basename(path)
    fm, body = frontmatter(lines)

    row = checks["B3"]
    for key in ("status", "type", "depends_on", "risk", "approve"):
        if key not in fm:
            f.fail(row, where, f"frontmatter key `{key}` missing", "required always")
    if "risk" in fm:
        score = fm["risk"].split("#")[0].strip()
        if score not in {"1", "2", "3", "4", "5"}:
            f.fail(row, where, f"risk `{score}` is not 1-5", "score the reach")
    if "approve" in fm:
        value = fm["approve"].split("—")[0].split("#")[0].strip()
        if value not in APPROVALS:
            f.fail(row, where, f"approve `{value}` outside {sorted(APPROVALS)}", "pick one")
    if "type" in fm:
        kind = fm["type"].split("#")[0].strip()
        if kind not in TYPES:
            f.fail(row, where, f"type `{kind}` outside {sorted(TYPES)}", "pick one change kind")
    for ref in TODO_REF.findall(fm.get("depends_on", "")):
        if int(ref) not in pairs:
            f.fail(row, where, f"depends_on names TODO-{ref}, which is not in the ledger", "fix the edge")
        if int(ref) == n:
            f.fail(row, where, "depends_on names itself", "remove the edge")

    row = checks["B4"]
    found = [t for _, t in headings(body)]
    order = [t for t in found if t in HUMAN_ORDER]
    for name in HUMAN_ORDER:
        if name not in found:
            f.fail(row, where, f"`## {name}` missing", "required always")
    if order != [t for t in HUMAN_ORDER if t in order]:
        f.fail(row, where, f"sections out of order: {' → '.join(order)}",
               " → ".join(HUMAN_ORDER))
    if "Deviations" in found and fm.get("status") == "todo":
        f.fail(row, where, "`## Deviations` written at status todo", "impl writes it, never arch")
    if "Deviations" in found:
        # The block is temporary — `revise` folds the rows in and deletes it — so the linked
        # note is the only record that outlives the correction. A row without one loses the reason.
        for i, line in enumerate(section(body, "Deviations"), 1):
            text = line.strip()
            if not text.startswith("|") or set(text) <= set("|- "):
                continue
            cells = [c.strip() for c in text.strip("|").split("|")]
            if cells[:1] == ["What"]:
                continue
            if not any("[[" in c for c in cells):
                f.fail(row, where, f"`## Deviations` row {i} names no thought note: {cells[0]}",
                       "add the [[NNN-impl-decision-slug]] holding the reason, before revise deletes the table")
    tail = [l for l in body if l.strip()]
    if not tail or "TODO-%d.agent.md" % n not in tail[-1]:
        f.fail(row, where, "last line is not the link to the agent half",
               f"**Increments:** [TODO-{n}.agent.md](TODO-{n}.agent.md)")

    row = checks["B5"]
    comp_rows = table_rows(section(body, "Components"))
    if not comp_rows:
        f.fail(row, where, "`## Components` has no table", "one row per package.Class")
    mains = 0
    for cells in comp_rows:
        if len(cells) < 5:
            f.fail(row, where, f"component row has {len(cells)} columns, needs 5",
                   "Component | Touch | Type | Part | Role")
            continue
        name, touch, brick, part = cells[0], cells[1].lower(), cells[2].lower(), cells[3].lower()
        if touch not in TOUCHES:
            f.fail(row, where, f"{name}: Touch `{cells[1]}` outside {sorted(TOUCHES)}", "")
        if brick not in BRICKS:
            f.fail(row, where, f"{name}: Type `{cells[2]}` is not a brick", f"one of {sorted(BRICKS)}")
        if part == "main":
            mains += 1
        elif part != "supporting":
            f.fail(row, where, f"{name}: Part `{cells[3]}` is not main/supporting", "")
    if comp_rows and mains != 1:
        f.fail(row, where, f"{mains} rows marked `main`", "exactly one component carries the Outcome")

    row = checks["B6"]
    surface = section(body, "Surface")
    if not any(l.strip().startswith("```diff") for l in surface):
        f.fail(row, where, "`## Surface` carries no ```diff block", "one diff per file")

    row = checks["E1"]
    auto = section(body, "Autotest")
    levels = {}
    current = None
    for line in auto:
        head = H3.match(line)
        m = head or LEVEL.match(line)
        name = (m.group(1) if m else "").strip().rstrip(":").lower()
        if m and name in ("unit", "e2e"):
            current = name.upper()
            levels[current] = ["" if head else m.group(2)]
        elif head:
            current = None
        elif current:
            levels[current].append(line)
    for level in ("UNIT", "E2E"):
        key = "Unit" if level == "UNIT" else "E2E"
        if level not in levels:
            f.fail(row, where, f"Autotest has no `{key}` level", "both levels, always")
            continue
        text = "\n".join(levels[level])
        head = levels[level][0].strip()
        if head.lower().startswith("none"):
            if not has_reason(head):
                f.fail(row, where, f"Autotest {key}: `none` with no concrete reason — `{head[:60]}`",
                       "name what makes the level impossible")
            for ref in TODO_REF.findall(head):
                if int(ref) not in pairs:
                    f.fail(row, where, f"Autotest {key} defers to TODO-{ref}, which is not in the ledger", "")
            continue
        keys = {m.group(1).strip().lower() for m in
                (BULLET_KEY.match(l) for l in levels[level]) if m}

        def has_key(name):
            return any(k.startswith(name) for k in keys)

        if not has_key("command"):
            f.fail(row, where, f"Autotest {key} has no **Command**", "one runnable shell command")
        if not has_key("cases"):
            f.fail(row, where, f"Autotest {key} has no **Cases**", "≥1 input → expected sentence")
        elif not re.search(r"→|->", text):
            f.fail(row, where, f"Autotest {key} Cases carry no `input → expected`", "write the case")
        if re.search(r"\bTBD\b", text, re.IGNORECASE) or any(
                l.strip().strip("-* ") in ("...", "…") for l in levels[level]):
            f.fail(row, where, f"Autotest {key} left as TBD", "fill it")


def increment_count(agent_lines):
    return len([l for l in section(agent_lines, "Changes") if INCREMENT.match(l)])


def landed_count(agent_lines):
    """How many increments carry `**Landed:** yes` — the markers `<approved>` indexes."""
    done = 0
    for line in section(agent_lines, "Changes"):
        m = BULLET_KEY.match(line)
        if m and m.group(1).strip().lower().startswith("landed"):
            if LANDED.match(m.group(2)) and m.group(2).strip(" `*").lower().startswith("yes"):
                done += 1
    return done


def check_progress(n, human_path, human_lines, agent_lines, f, checks):
    where = os.path.basename(human_path)
    row = checks["B11"]
    fm, _ = frontmatter(human_lines)
    total = increment_count(agent_lines)

    if "increment" not in fm:
        f.fail(row, where, "frontmatter key `increment` missing",
               f"`increment: 0/{total}` at authoring, then one step per approved increment")
        return
    value = fm["increment"].split("#")[0].strip()
    m = PROGRESS.match(value)
    if not m:
        f.fail(row, where, f"increment `{value}` is not `<done>/<total>`", "count the approved increments")
        return

    done, claimed = int(m.group(1)), int(m.group(2))
    if total and claimed != total:
        f.fail(row, where, f"increment total {claimed} but the agent half has {total} increments",
               "the pair drifted — renumber one side")
    if done > claimed:
        f.fail(row, where, f"increment {done}/{claimed} counts more done than there are", "")

    marked = landed_count(agent_lines)
    if total and marked != done:
        f.fail(row, where,
               f"increment says {done} approved, the agent half marks {marked} `**Landed:** yes`",
               "impl writes both in the same step — one of them was missed")

    status = fm.get("status", "").split("#")[0].strip()
    if status == "todo" and done != 0:
        f.fail(row, where, f"status todo with increment {done}/{claimed}",
               "no increment is applied before impl starts")
    if status in ("verify", "done") and done != claimed:
        f.fail(row, where, f"status {status} with increment {done}/{claimed}",
               "every increment is in the commit before the TODO leaves impl")


def check_agent(n, path, lines, f, checks):
    where = os.path.basename(path)

    row = checks["B7"]
    if lines and lines[0].strip() == "---":
        f.fail(row, where, "agent half has frontmatter", "status lives in the human half alone")
    first = next((l for l in lines if l.strip()), "")
    if f"TODO-{n}.md" not in first and not first.startswith("# "):
        f.fail(row, where, "first line is not the link back to the human half",
               f"**Design:** [TODO-{n}.md](TODO-{n}.md)")
    found = [t for _, t in headings(lines)]
    for name in AGENT_ORDER:
        if name not in found:
            alt = name.split(" (")[0]
            if alt not in found:
                f.fail(row, where, f"`## {name}` missing", "required always")
    present = [t for t in found if t in AGENT_ORDER]
    if present != [t for t in AGENT_ORDER if t in present]:
        f.fail(row, where, f"sections out of order: {' → '.join(present)}", " → ".join(AGENT_ORDER))

    row = checks["B8"]
    constraints = section(lines, "Constraints")
    if any(TABLE_ROW.match(l) for l in constraints):
        f.fail(row, where, "`## Constraints` carries a table", "the generator command alone — a copied rule drifts")
    if not any("wm-constraints.py" in l for l in constraints):
        f.fail(row, where, "`## Constraints` does not name wm-constraints.py", "the fixed pointer line")

    row = checks["B9"]
    changes = section(lines, "Changes")
    numbers, blocks = [], {}
    current = None
    for line in changes:
        m = INCREMENT.match(line)
        if m:
            current = int(m.group(1))
            numbers.append(current)
            blocks[current] = []
        elif current is not None:
            blocks[current].append(line)
    if not numbers:
        f.fail(row, where, "`## Changes` has no increments", "one H3 per increment")
    if numbers != list(range(1, len(numbers) + 1)):
        f.fail(row, where, f"increments not contiguous from 1: {numbers}", "renumber")
    if len(numbers) > MAX_INCREMENTS:
        f.fail(row, where, f"{len(numbers)} increments, budget is {MAX_INCREMENTS}", "split the TODO")
    if any(l.strip().startswith("```diff") for l in changes):
        f.fail(row, where, "```diff inside `## Changes`", "the diff is the human half's ## Surface")
    for k, body in blocks.items():
        keys = {}
        for line in body:
            m = BULLET_KEY.match(line)
            if m:
                keys[m.group(1).strip().lower()] = m.group(2).strip()
        for needed in ("landed", "change", "files", "surface", "do", "blast radius"):
            if not any(k.startswith(needed) for k in keys):
                f.fail(row, f"{where} § increment {k}", f"no **{needed.title()}**", "required per increment")
        landed = next((v for k, v in keys.items() if k.startswith("landed")), "")
        if landed and not LANDED.match(landed):
            f.fail(row, f"{where} § increment {k}", f"Landed `{landed}` is not yes or no",
                   "`no` until the increment is in the commit, then `yes`")
        kind = next((v for k, v in keys.items() if k.startswith("change")), "").strip(" .`*").lower()
        if kind and kind not in TYPES:
            f.fail(row, f"{where} § increment {k}", f"Change `{kind}` outside {sorted(TYPES)}",
                   "pick one change kind (impl:ref-change-types.md)")
        blast = next((v for k, v in keys.items() if k.startswith("blast radius")), "").strip(" .`*")
        if blast and blast.lower() in VAGUE_BLAST:
            f.fail(row, f"{where} § increment {k}", f"Blast radius `{blast}` names no symbol or caller",
                   "name what the increment can break")
        do_text = next((v for k, v in keys.items() if k.startswith("do")), "")
        if pastes_code(do_text):
            f.fail(row, f"{where} § increment {k}", "**Do** carries a signature",
                   "the signature belongs to § Surface alone")

    row = checks["B10"]
    for line in section(lines, "Files"):
        m = re.match(r"^\s*[-*]\s*`([^`]+)`", line)
        if m and ("*" in m.group(1) or m.group(1).rstrip().endswith("/")):
            f.fail(row, where, f"Files entry `{m.group(1)}` is a glob or a directory", "concrete paths only")

    row = checks["E2"]
    manual = "\n".join(section(lines, "Manual test")).strip()
    low = manual.lower()
    if not manual:
        f.fail(row, where, "`## Manual test` empty", "steps + expected, or `skip — reason: <concrete>`")
    elif "skip" in low.split("\n")[0][:40]:
        if not has_reason(manual.split("\n")[0]):
            f.fail(row, where, f"Manual test skipped with no concrete reason — `{manual.splitlines()[0][:60]}`",
                   "name the reason a human step buys nothing")
    elif "tbd" in low:
        f.fail(row, where, "Manual test left as TBD", "fill it")


def run(notes, as_json=False, quiet=False):
    if not os.path.isdir(notes):
        print(f"spec-lint: no notes dir at '{notes}'", file=sys.stderr)
        return 2

    f = Findings()
    pairs = todo_pairs(notes)

    check_budgets(notes, f)
    check_rules(notes, f)
    check_open_questions(notes, f)
    check_spec(notes, pairs, f)
    check_pairs_exist(notes, pairs, f)
    check_glossary(notes, pairs, f)

    checks = {
        "B3": f.check("B3", "human half frontmatter — keys, risk 1-5, approve, type, depends_on"),
        "B4": f.check("B4", "human half sections — present, ordered, link out, deviations named a note"),
        "B5": f.check("B5", "Components — brick, touch, exactly one main"),
        "B6": f.check("B6", "Surface carries the diff"),
        "E1": f.check("E1", "Autotest — Unit and E2E, command + cases or a real reason"),
        "B7": f.check("B7", "agent half sections — present, ordered, no frontmatter, link back"),
        "B8": f.check("B8", "Constraints is the generator pointer, never a rule table"),
        "B9": f.check("B9", "increments — contiguous, ≤10, six keys each, valid Landed + Change, no diff, no signature in Do"),
        "B10": f.check("B10", "Files are concrete paths"),
        "E2": f.check("E2", "Manual test filled, or skipped with a concrete reason"),
        "B11": f.check("B11", "increment progress — `<done>/<total>`, total matches the agent half, done matches the Landed markers and fits status"),
    }
    for n in sorted(pairs):
        human, agent = pairs[n].get("human"), pairs[n].get("agent")
        if human:
            lines = read(human) or []
            check_human(n, human, lines, pairs, f, checks)
        if agent:
            lines = read(agent) or []
            check_agent(n, agent, lines, f, checks)
        if human and agent:
            check_progress(n, human, read(human) or [], read(agent) or [], f, checks)

    if as_json:
        print(json.dumps(f.checks, indent=2))
        return 1 if f.failed else 0

    width = max(len(c["title"]) for c in f.checks) + 2
    print(f"spec-lint {notes} — {len(pairs)} ledger row(s)\n")
    for c in f.checks:
        if c.get("skipped"):
            verdict = f"n/a — {c['skipped']}"
        elif c["findings"]:
            verdict = f"{len(c['findings'])} finding(s)"
        else:
            verdict = "clean"
        print(f"  [{c['id']:>3}] {c['title']:<{width}} {verdict}")
    if f.failed and not quiet:
        print("\nFindings\n")
        for c in f.failed:
            for hit in c["findings"]:
                remedy = f" — {hit['remedy']}" if hit["remedy"] else ""
                print(f"  [{c['id']}] {hit['where']}: {hit['message']}{remedy}")
    return 1 if f.failed else 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        sys.exit(2)
    sys.exit(run(args[0], as_json="--json" in sys.argv, quiet="--quiet" in sys.argv))
