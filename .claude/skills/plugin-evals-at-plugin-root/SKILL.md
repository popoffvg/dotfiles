---
name: plugin-evals-at-plugin-root
description: Use when adding an eval suite, test fixtures, or a grading runner for a skill that lives in a plugin under harness/plugins/. Trigger on "write evals for this skill", "add a rubric", "grade the gate", or when choosing where cases.jsonl and run.sh go.
user-invocable: false
metadata:
  origin: self-improvement
---

Evals for a plugin's skill go at the **plugin root**, not inside the skill directory.

```
harness/plugins/<plugin>/
  evals/
    run.sh          # reads the spec from ../skills/<skill>/SKILL.md at run time
    cases.jsonl     # one suite per graded skill: cases-<skill>.jsonl when there are several
    README.md
  skills/<skill>/
    SKILL.md
    CASE.md
```

- A skill directory holds what Claude loads: `SKILL.md`, `references/`, `GLOSSARY.md`, `CASE.md`. An eval suite is not loaded — it grades the skill from outside.
- One `evals/` per plugin serves every skill in it. Nested `skills/*/evals/` fragments the suite and hides it from anyone looking at the plugin.
- The runner extracts the graded section from the skill at run time (`awk` between headings), so the suite always grades the current spec instead of a copy that drifts.
- Reference it from the skill as `${CLAUDE_PLUGIN_ROOT}/evals/`, not a relative path — the skill may be read from the plugin cache.
