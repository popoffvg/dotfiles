---
name: work-implement
description: >
  Implement phase. Execute exactly ONE TODO from `<notes-dir>/todos/TODO-N.md`,
  then stop and hand control back to the user for verification and commit.
  The skill never commits — the user owns the commit boundary.
---

# work:implement

Implement exactly one TODO per invocation. The user reviews the result, runs their own tests, and creates the commit themselves.

## Contract

- **One TODO per run.** Pick the target TODO, execute it end-to-end, stop.
- **No commits.** Do not run `git commit`, `git add` (beyond what tooling already stages), `git reset`, or any history-rewriting command. The user commits manually.
- **No autopilot.** Do not loop to the next TODO. After reporting, wait for the user.
- **No checkbox bookkeeping.** plan.md has no TODO list. Completion is signalled by the user's commit, not by editing files.
- **Plan is read-only here.** Do not edit `<notes-dir>/plan.md`. Edit `<notes-dir>/todos/TODO-N.md` only if implementation reveals the spec was wrong — and log it in `worklog.md`.

## Step 1: Pick the TODO

- If the user named a TODO (`TODO-3`, "the auth refresh todo"), use that one.
- Otherwise pick the lowest-numbered `<notes-dir>/todos/TODO-N.md` not yet marked done in `<notes-dir>/worklog.md`.
- If ambiguous, ask the user which TODO before starting.

## Step 2: Read context

1. Read the target `<notes-dir>/todos/TODO-N.md` in full — it is the complete spec.
2. Read `<notes-dir>/plan.md` Terms and Design Decisions for domain vocabulary.
3. Read every file listed in the TODO's **Pre-reads** and **Files** sections.
4. Read any `<notes-dir>/research-*.md` referenced by the TODO.

## Step 3: Mid-task replan guard

Before editing, scan user messages since the last TODO completion for plan-altering signals: "actually", "let's also", "I changed my mind", new acceptance criteria, contradictions with the TODO file.

If found:
1. Stop. Update `<notes-dir>/todos/TODO-N.md` (or create a new TODO file) to reflect the new intent.
2. Append `[REPLAN]` line to `<notes-dir>/worklog.md` with the user quote and what changed.
3. Confirm with the user, then proceed against the updated TODO.

## Step 4: Implement

Identify the primary language from **Files** and apply the matching rules:

| Extension | Skill / tools | Validation before reporting done |
|---|---|---|
| `.go` | `go-modify`, gopls | `go vet`, `staticcheck`, `go test ./<pkg>/...` |
| `.proto` | `proto-change`, buf | Re-run codegen so generated files are current; do not hand-edit generated artifacts |
| `.sh`, `.bash` | `shell-modify` | `shellcheck`, `bash -n` |
| `.ts`, `.tsx`, `.js` | — | `tsc --noEmit`, project test runner, `eslint` if configured |
| `.py` | — | `mypy`/`pyright`, `pytest`, `ruff` if configured |
| `.yaml`/`.json`/`.toml` | — | syntax validators (`yq`, `python -m json.tool`) |
| `.md` | — | none beyond rendering check |

Rules:
- Plan all edits before touching any file. One pass per file — no thrashing.
- Implement exactly what **Changes** specifies in the TODO file. Don't add scope.
- If a generated artifact is in **Files**, the source must be too; re-run codegen rather than editing generated output.
- If you edit the same file 3+ times without tests passing → **stop and report a blocker** to the user.

## Step 5: Run autotests

Run the command from the TODO's **Autotest** section. Iterate until it passes or you hit the 3-edit blocker rule.

Do not silently weaken the test. If the test is wrong, report it; the user decides.

## Step 6: Report and stop

Do **not** commit. Do **not** check anything off. Do **not** start the next TODO.

Append to `<notes-dir>/worklog.md`:

```
- YYYY-MM-DD HH:MM: [TODO-N] implemented (awaiting user verification)
  - changed `path/to/file.go:42` — <one-line summary>
  - autotest: pass | fail (details)
```

Then send the user a summary message containing:

1. **TODO**: `TODO-N — <title>`
2. **Files changed** (with line ranges where useful)
3. **Autotest result** (command + outcome)
4. **Manual test steps** copied verbatim from the TODO's **Manual test** section, for the user to run
5. **Anything notable** — deviations from the TODO, follow-ups, blockers
6. Explicit handoff line: *"Review the diff and commit when satisfied. I will not commit."*

Stop. Wait for the user. Do not move on, do not summarise further, do not start TODO-N+1.

## When the user comes back

- **"looks good" / "commit it yourself" / explicit commit request** → only then run `git add`/`git commit` (follow `work-commit` for message format).
- **"fix X"** → treat as a continuation of the same TODO. Edit, re-test, re-report. Still no commit.
- **"next" / "next todo" / `/work:next`** → pick the next TODO per Step 1 and start over.
- **`FIX` / `FIXUP <description>`** → user is asking for a correction to *their own* prior commit. Make the edit, stage it, and tell the user the change is staged — let them run `git commit --fixup` themselves.

## Hard rules

- Never `git commit` without an explicit user instruction in the current turn.
- Never edit `<notes-dir>/plan.md`. Edits to `<notes-dir>/todos/TODO-N.md` require a `worklog.md` entry.
- Never run more than one TODO per invocation.
- Never `rm -rf` a generated directory; re-run the generator in place.
- If a tool returns a permission/access error, ask the user — don't retry blindly.

## Autoresearch rules

**Can change:** validation tool list per language, report template wording, blocker thresholds, replan detection signals
**Cannot change:** one-TODO-per-run contract, no-commit contract, stop-and-handoff contract, read-only-plan contract
**Min sessions before eval:** 5
**Runs per experiment:** 3
