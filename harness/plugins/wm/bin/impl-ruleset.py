#!/usr/bin/env python3
"""Print the impl ruleset one TODO runs under: the resolved `approve` and `risk`, then the matching
files from `skills/impl/rulesets/`.

`approve` resolves as `arch:ref-write.md` § Approval says: `--auto` → `none`; else `risk: red` →
`increment`; else the TODO key; else (`inherit` or no key) the spec key; else `increment`.

usage: impl-ruleset.py <notes-dir> <TODO-N> [--auto]
exit 0 printed - 2 unusable notes dir, TODO, or key value
Tool index — every .notes tool and its flags: wm:TOOLS.md
"""
import os
import sys

RULESETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "skills", "impl", "rulesets")
APPROVE_VALUES = ("increment", "todo", "none")
RISK_VALUES = ("red", "yellow", "green")
SPEC_DEFAULT_APPROVE = "increment"


def frontmatter(path):
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    keys = {}
    for line in lines[1:]:
        if line.strip() == "---":
            return keys
        if ":" in line:
            k, _, v = line.partition(":")
            keys[k.strip()] = v.split("#")[0].strip()
    return {}


def fail(message):
    print(f"impl-ruleset: {message}", file=sys.stderr)
    sys.exit(2)


def resolve_approve(todo_keys, spec_keys, risk, auto):
    if auto:
        return "none", "--auto: nobody is watching"
    if risk == "red":
        return "increment", "risk: red"
    todo_value = todo_keys.get("approve", "inherit")
    if todo_value != "inherit":
        return todo_value, "TODO frontmatter"
    spec_value = spec_keys.get("approve")
    if spec_value:
        return spec_value, "spec.md frontmatter"
    return SPEC_DEFAULT_APPROVE, "default: no key on the TODO or spec.md"


def main(argv):
    auto = "--auto" in argv
    args = [a for a in argv if a != "--auto"]
    if len(args) != 2:
        fail("usage: impl-ruleset.py <notes-dir> <TODO-N> [--auto]")
    notes, todo = args
    todo_path = os.path.join(notes, "todos", f"{todo}.md")
    spec_path = os.path.join(notes, "spec.md")
    if not os.path.isfile(todo_path):
        fail(f"no TODO file at {todo_path}")
    todo_keys = frontmatter(todo_path)
    spec_keys = frontmatter(spec_path) if os.path.isfile(spec_path) else {}

    risk = todo_keys.get("risk", "")
    if risk not in RISK_VALUES:
        fail(f"{todo} risk `{risk}` is not one of {', '.join(RISK_VALUES)}")
    approve, source = resolve_approve(todo_keys, spec_keys, risk, auto)
    if approve not in APPROVE_VALUES:
        fail(f"{todo} approve `{approve}` from {source} is not one of {', '.join(APPROVE_VALUES)}")

    print(f"# impl ruleset — {todo}\n")
    print(f"- approve: `{approve}` — set by {source}")
    print(f"- risk: `{risk}`\n")
    for name in (f"approve-{approve}.md", f"risk-{risk}.md"):
        with open(os.path.join(RULESETS, name), encoding="utf-8") as f:
            print(f.read().rstrip() + "\n")


if __name__ == "__main__":
    main(sys.argv[1:])
