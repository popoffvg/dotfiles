---
name: work-implement
description: >
  This skill should be used when the current work phase is "implement".
  Two modes: autopilot (all TODOs) or manual (one TODO via /work:next).
  Default is autopilot — all TODOs run autonomously.
  Manual mode available via /work:next (one TODO at a time).
---

# work:implement

Implement phase workflow. Behavior depends on `implementMode` in `.pi/work.settings.json`:

- **autopilot** (default): Execute all TODOs autonomously — do not ask the user for guidance.
- **manual**: Execute one TODO per `/work:next` call, then stop and return control.

Your state was auto-committed before entering this phase. Work freely.

## ⚠️ Repository scope

A worktree is created automatically by `/work:start` (check `worktreePath` in settings). If a worktree is active, make all code changes there. If not, work in the current directory.

- Use `_notes/` (plan.md, worklog.md) for planning/logging.
- Commit on the worktree branch (or current branch when no worktree is active).

## Step 1: Read the plan

Read `_notes/plan.md` for the TODO list. Read `_notes/research-*.md` for additional context.

## Step 2: Execute TODOs in order

For each unchecked `- [ ]` TODO in `_notes/plan.md`:

### 2a. Determine language and spawn the right subagent

Read the TODO header — identify the primary language from the file extensions in **Details**. Then spawn a **language-specific subagent** with the TODO context:

| File extension | Subagent type | Instructions to include |
|---|---|---|
| `.go` | `go-developer` | Use gopls for validation. Run `go vet` + `staticcheck` before tests. Run `go test ./...` for the package. Follow `go-modify` skill. |
| `.sh`, `.bash` | `general-purpose` | Follow `shell-modify` skill. Run `shellcheck` on changed files. Test with `bash -n` for syntax, then execute. |
| `.ts`, `.tsx`, `.js` | `general-purpose` | Run `tsc --noEmit` for type checking. Run `npm test` / `vitest` / `jest` for tests. Check with `eslint` if available. |
| `.py` | `general-purpose` | Run `mypy` or `pyright` for type checking. Run `pytest` for tests. Check with `ruff` or `flake8` if available. |
| `.yaml`, `.yml`, `.json`, `.toml` | `general-purpose` | Validate syntax (e.g. `python -m json.tool`, `yq`). No tests unless schema validation exists. |
| `.md`, docs | `general-purpose` | No static analysis needed. Verify links if applicable. |
| Mixed / multiple languages | `general-purpose` | Identify each file's language, apply the corresponding rules above for each file. |

### 2b. Subagent prompt template

When spawning a subagent for a TODO, include this in the prompt:

```
TODO: <full TODO header + details from plan.md>

FILES TO MODIFY: <list from Details>
AUTOTEST: <autotest strategy from plan>
MANUAL TEST: <manual test strategy from plan>

LANGUAGE RULES:
<insert language-specific instructions from table above>

CONTRACT:
1. Read full target files before editing
2. Plan all edits before touching any file — single pass per file, no thrashing
3. Implement the change
4. Run static analysis on changed files — fix all errors
5. Run tests specified in AUTOTEST — fix until passing
6. If edited same file 3+ times without tests passing — STOP and report blocker
7. Stage changes with `git add`
8. Report: changed files, test results, any issues
```

### 2c. Post-subagent validation

After the implementation subagent returns:
1. Verify the TODO is fully satisfied (code + tests)
2. If test coverage is narrow/insufficient, note in `_notes/worklog.md` and tell user manual verification is required
3. If `approveCommits` is enabled in settings: **Ask the user for approval before committing.** Show: TODO text, changed files, and test results. Wait for explicit "yes"/"ok"/"approve". If rejected — fix and ask again.
4. **Commit the changes** with a meaningful message referencing the TODO
5. **Hard guard:** never check off a TODO until commit succeeds (or user explicitly says "no commit").

### 2d. Run manual-tester agent

After committing, spawn the `manual-tester` agent (from `harness/agents/`) for this TODO:

```
Agent(
  subagent_type: "general-purpose",
  prompt: """
  You are a QA tester. Follow the instructions in harness/agents/manual-tester.md.

  MODE: TODO mode
  TODO: <full TODO-N header from plan.md>
  AUTOTEST from plan: <autotest field>
  MANUAL TEST from plan: <manual-test field>
  COMMIT: <last commit SHA>

  Run the autotest checks, execute manual test steps where possible,
  write report to _notes/test-report-TODO-N.md.
  If any test FAILS — report clearly, do NOT fix code.
  """
)
```

After the tester returns:
- Read `_notes/test-report-TODO-N.md`
- If **all tests PASS** → continue
- If **any test FAIL** → log failure in `_notes/worklog.md`, ask the user whether to fix now or continue. Do NOT silently skip failures.

### 2e. Finalize TODO

6. Check off the TODO: `- [ ]` → `- [x]`
7. Log what was done to `_notes/worklog.md` (include test report summary)
8. **Call `work_compact`** with a brief summary of what was completed
9. Continue to the next TODO

**IMPORTANT: Call `work_compact` after each TODO.** Long implementation sessions accumulate tool calls, file reads, and test output that consume context. Compaction discards this noise and re-injects the current plan + worklog, keeping you focused on remaining work.

**Each TODO = one git commit.** Commit only after implementation + tests + re-tests confirm the TODO is done. Follow the `work-commit` skill for commit message format:
- Prefix: `feat|fix|doc|test|build|refactor`
- Message describes **why**, not what: e.g. `feat: support token refresh on expired sessions`
- ≤ 72 chars, imperative mood, no period

## Joining commits (user "join" / "merge" / "squash" messages)

When the user asks to combine or join N previous commits (e.g., "join items 1,2,3" or "squash last 3 commits"):

1. Count how many commits to squash: N
2. Run: `git reset --soft HEAD~N`
3. All changes are now staged. Commit with a single unified message:
   `git commit -m "<prefix>: <unified why description>"`
4. Log to worklog: `- YYYY-MM-DD HH:MM: [SQUASH] joined last N commits into one`
5. Do NOT check off any new TODOs — this is a history cleanup, not new work

## Fixup commits (user FIX / FIXUP messages)

When the user sends a message starting with **FIX** or **FIXUP** during implementation, they are requesting a correction to a previous commit. Handle it as a git fixup commit:

1. Implement the requested fix
2. Stage the changes
3. Find the target commit to fix: `git log --oneline -10` and identify which commit the fix applies to
4. Create a fixup commit: `git commit --fixup=<target-sha>`
   - This produces a commit message like `fixup! feat: original message`
5. Log to worklog: `- YYYY-MM-DD HH:MM: [FIXUP] <description> (target: <short-sha>)`
6. **Do NOT check off any TODO** — fixups are corrections, not new work
7. Continue with the current TODO you were working on

The fixup commits will be squashed into their targets later via `git rebase -i --autosquash`.

**Examples of user fixup messages:**
- `fix: forgot to add error handling in auth.go` → fixup the commit that touched auth.go
- `fixup missing test for edge case` → fixup the most recent test commit
- `FIX: typo in config key` → fixup the commit that introduced the config

## CRITICAL: plan.md edit rules

**`_notes/plan.md` is editable during implement phase when needed.**
This supersedes older restricted guidance ("checkbox-only edits"). Do not apply the old restriction.
- ✅ Allowed:
  - `- [ ]` → `- [x]` (check off completed TODOs)
  - Clarify TODO wording when implementation reveals ambiguity
  - Split or reorder TODOs when required for correct execution
  - Add or update acceptance criteria discovered during implementation
  - Add brief notes under TODOs to capture implementation constraints
- ❌ Forbidden:
  - Deleting completed history without logging why
  - Silent scope expansion unrelated to user goals
  - Rewriting the entire plan without preserving intent
- **Every non-checkbox plan edit must be logged in `_notes/worklog.md`** with reason and timestamp.
- If the change affects scope or priorities significantly, ask the user before proceeding.

## Execution rules

- **NEVER skip a TODO.** If a TODO is unclear, blocked, or you can't figure out how to do it — **ask the user**. Do not skip it, do not log it as SKIP, do not move on. Wait for the user's answer.
- **Work autonomously** — don't ask for permission on routine decisions.
- **DO ask the user** when you need approval for risky changes, unclear requirements, or missing details. Examples: deleting data, changing public APIs, ambiguous TODOs, picking between fundamentally different approaches.
- **Defend technical decisions before switching.** When the user questions a design choice (format, approach, algorithm), present trade-offs of 2–3 alternatives instead of immediately switching. Only change after the user picks an option. Premature capitulation causes churn.
- **If a tool returns a permission/access error**, ask the user for help instead of retrying blindly.
- **If blocked on something minor**, try a reasonable workaround and log the decision in worklog.

### Clarification-first behavior (reduce phase confusion)

- If the user sends a short correction like **"i mean for implement phase"**, treat it as a scope reset for the very next action.
- After such correction, restate the active mode in one line ("implement phase: execute next TODO action") and immediately perform a concrete implementation step.
- Do **not** switch to meta/review narration first (for example, lengthy reviewer workflow explanation) unless the user explicitly asked for review.
- If the user asks for **skill maintenance during implement** (e.g. "auto-improve work-implement"), do that maintenance task directly in the referenced skill file before returning to code TODO execution.
- If you presented options and the user picks one (for example, "option A"), execute that option immediately. Do not re-open option discussion.
- If selected option says to "read the skills" or "read Pi logic", perform those reads first, then continue implementation actions.
- If the user explicitly says `/work-next`, execute exactly one next unchecked TODO end-to-end using this same checklist (including staging, commit, checkbox, worklog, and `work_compact`) before returning control.
- Never infer `/improve` or any other command from keypress words (for example, "tab"). Only run explicit slash commands typed by the user.

## Step 3: Log progress to worklog

After each TODO, append to `_notes/worklog.md`:

```
- YYYY-MM-DD HH:MM: [TODO] <todo text>
  - changed `path/to/file.go:42` — added refresh endpoint
  - changed `path/to/test.go:15` — added integration test
  - tests: pass
```

**Do NOT create `impl-*.md` files. Everything goes in worklog.**

## Step 4: Final verification

After all TODOs are checked off:
- Run a final test pass
- Log summary to worklog

## Step 5: Mark implementation complete

**This is mandatory.** After implementation is complete:

1. Confirm all TODOs are checked and each completed TODO has a commit (unless user explicitly waived commits).
2. Append to `_notes/worklog.md`: `- YYYY-MM-DD HH:MM: Implementation complete`
3. Stop execution.

**Do NOT mutate `.pi/work.settings.json` to `auto-verify`** (that phase is not part of current FSM).
Phase transitions are command-driven (`/work:plan` or `/work:abandon`) and handled outside this skill.

## Autoresearch rules

**Eval checklist:**
1. Did every TODO complete in a single pass without re-reading the plan mid-TODO?
2. Were there zero files edited 3+ times for the same TODO (no thrashing)?
3. Did every commit pass tests before being created (no fix-after-commit)?
4. Was `work_compact` called after each TODO completion?
5. Did the agent avoid asking the user for guidance on routine decisions?

**Test inputs:**
- "Implement 3-TODO plan: add endpoint, write tests, update docs"
- "Implement plan with a TODO that has failing tests on first run"
- "Implement plan where one TODO depends on output of previous TODO"

**Can change:** execution steps, edit strategy, thrashing detection threshold, logging format, review flow
**Cannot change:** commit-per-TODO contract, work_compact requirement, autonomous execution principle
**Min sessions before eval:** 5
**Runs per experiment:** 3
