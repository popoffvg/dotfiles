---
name: impl-verify
description: >
  Adversarially verify that an implemented TODO satisfies its spec. Reads
  `<notes-dir>/todos/TODO-N.md` (Outcome, Changes, Autotest), inspects the real diff/commit,
  re-runs the Autotest, and writes a `<notes-dir>/verify-TODO-N.md` verdict (PASS | DEVIATES)
  with a deviation list. Independent of the implementer — the post-implementation half of
  spec verification. Run after impl, before the user commits (or right after the commit).
---

# impl-verify

Judge one implemented TODO against its spec. The implementer self-reports; this skill
re-derives the verdict from the spec + the actual code + a fresh test run. **The Outcome is
the anchor** — everything is checked against it (mirrors the spec verification chain
Type → Outcome → Terms → Changes → Autotest).

## Inputs

- `<notes-dir>/todos/TODO-N.md` — the spec for this unit (Outcome, Changes, Autotest, Files, Definition of done).
- The real change: `git diff` / `git show <sha>` for the commit(s) implementing TODO-N (find via `<notes-dir>/worklog.md`).

## Procedure

1. **Read the TODO fully.** Pin the **Outcome** (the post-condition) and the **Changes** pseudocode.
2. **Inspect the real diff.** For each file in **Files**, confirm the change exists and matches the Changes intent. Flag edits *outside* Files (scope creep) and Files that were *not* touched (incomplete).
3. **Re-run the Autotest yourself.** Execute the TODO's `## Autotest` **Command** verbatim. Capture real output. If it fails or the command is missing/uncrunnable → DEVIATES.
4. **Map Outcome → evidence.** State, in one line, *which* test case or diff hunk proves the Outcome holds. No evidence → DEVIATES.
5. **Check the Definition of done** boxes against reality, not against the implementer's claims.

## Verdict contract — write `<notes-dir>/verify-TODO-N.md`

```markdown
# Verify TODO-N: <title>

**Verdict:** PASS | DEVIATES
**Commit(s):** <sha(s)>
**Autotest:** `<command>` → <pass | fail> (<real summary of output>)

## Outcome check
- Outcome: <restate verbatim from TODO-N.md>
- Holds? <yes/no> — evidence: <test case / diff hunk that proves it>

## Deviations
- <each gap between spec and implementation; empty if PASS>
  - <scope creep: edits outside Files> / <missing: Files not changed> / <Outcome unproven> / <test gap>

## Notes
- <anything the user should know before committing>
```

## Rules

- **Skeptical default:** if the Outcome cannot be proven from the diff + a passing test, verdict is **DEVIATES**.
- **Read-only on source.** Only write `<notes-dir>/verify-TODO-N.md` and a one-line `<notes-dir>/worklog.md` entry. Never fix the code — report deviations for the implementer/user to address.
- **One TODO per run**, then stop.
- A DEVIATES verdict is not a failure of process — it is the loop working. List concrete, actionable deviations.
