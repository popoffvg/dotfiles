---
name: work-implement
description: >
  This skill should be used when the current work phase is "implement".
  LLM executes the plan autonomously. After completion, auto-transitions to auto-verify.
---

# work:implement

Implement phase workflow. **Execute autonomously — do not ask the user for guidance.**

Your state was auto-committed before entering this phase. Work freely.

## ⚠️ Repository scope

A worktree is created automatically by `/work:start` (check `worktreePath` in settings). If a worktree is active, make all code changes there. If not, work in the current directory.

- Use `_notes/` (plan.md, worklog.md) for planning/logging.
- Commit on the worktree branch (or current branch when no worktree is active).

## Step 1: Verify plan is approved

1. Call `work_state` to read current settings
2. Confirm the phase history shows `plan-verify` was completed. If the previous phase was `plan` (not `plan-verify`), **stop immediately** — tell the user: "Plan must pass verification before implementation. Run `/work:plan-verify` first." Do not proceed.
3. Read `_notes/plan.md` — confirm it has no unchecked items in the `## Verification` section (left by plan-verifier). If unresolved items exist, **stop** and tell the user to fix them first.

## Step 2: Read the plan

Read `_notes/plan.md` for the TODO list. Read `_notes/research-*.md` for additional context.

## Step 3: Execute TODOs in order

### cmux session-per-TODO (when inside cmux)

If `$CMUX_SURFACE_ID` is set, each TODO runs in a **fresh Claude pane** to keep context clean. Follow the `work-cmux` skill for orchestration details.

**Flow for each unchecked TODO:**

1. **Prepare the prompt** — self-contained context for the TODO:
   - Full TODO text and acceptance criteria from `_notes/plan.md`
   - Relevant file paths and constraints
   - Instruction to commit after passing tests (use `work-commit` format)
   - Instruction: after commit, check off the TODO in `_notes/plan.md` and log to `_notes/worklog.md`

2. **Launch a new Claude pane via cmux:**
   ```bash
   OUTPUT=$(cmux new-pane --type terminal --direction right --cwd "$PWD")
   SURFACE=$(echo "$OUTPUT" | grep -o 'surface:[0-9]*')
   cmux send --surface "$SURFACE" "claude --dangerously-skip-permissions '<todo-prompt>'"
   cmux send-key --surface "$SURFACE" enter
   ```

3. **The new session executes the TODO** — implement, test, commit.

4. **User reviews the commit** and approves.

5. **Close the pane** after approval: `cmux close-surface --surface "$SURFACE"`

6. **If more TODOs remain** — repeat from step 1 with a fresh pane for the next TODO.

7. **When all TODOs are done** — proceed to Step 4 (log progress) and Step 5 (final verification).

**When NOT in cmux** (`$CMUX_SURFACE_ID` is empty), execute TODOs sequentially as described below.

For each unchecked `- [ ]` TODO in `_notes/plan.md`:
1. **Load required skills first.** If the TODO has a `skills:` sub-item, read each listed skill's SKILL.md before starting. Use absolute paths from `<available_skills>` in the system prompt. Follow skill instructions throughout the TODO.
2. **Read full files first.** Before editing any file, read it entirely. Note file-level constraints (strict modes, build tags, linter directives, error handling conventions). Your edits must be consistent with these constraints.
3. **Plan all edits before touching any file.** Identify every function, type, and section you need to change across all files. Write out the full list mentally. Then make all changes in a single pass per file — do NOT make a partial edit, run tests, then edit again. Piecemeal edits to the same file cause thrashing.
4. Implement the change described
5. **Run static analysis** on changed files before testing. Use the appropriate language-specific linter/checker for the file type. Fix all errors before proceeding.
6. Run relevant tests for that TODO
7. If tests fail, fix and **re-test** until passing. **If you have edited the same file 3+ times without passing tests, stop.** Describe what is blocking to the user and wait for guidance — do not keep making speculative edits.
8. Verify the TODO is fully satisfied (code + tests)
9. If test coverage is narrow/insufficient for the change, note that in `_notes/worklog.md` and tell the user manual verification is required
10. **Stage changes** with `git add` for the files you changed
11. If `approveCommits` is enabled in settings: **Ask the user for approval before committing.** Show: TODO text, changed files, and test results. Wait for explicit "yes"/"ok"/"approve". If rejected — fix and ask again.
12. **Commit the changes** with a meaningful message referencing the TODO (commit only after steps 1–11 are complete)
13. Check off the TODO: `- [ ]` → `- [x]`
14. Log what was done to `_notes/worklog.md`
15. **Call `work_compact`** with a brief summary of what was completed — this frees context space and re-injects the plan so you stay oriented
16. Continue to the next TODO

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

## Step 4: Log progress to worklog

After each TODO, append to `_notes/worklog.md`:

```
- YYYY-MM-DD HH:MM: [TODO] <todo text>
  - changed `path/to/file.go:42` — added refresh endpoint
  - changed `path/to/test.go:15` — added integration test
  - tests: pass
```

**Do NOT create `impl-*.md` files. Everything goes in worklog.**

## Step 5: Final verification

After all TODOs are checked off:
- Run a final test pass
- Log summary to worklog

## Step 6: Mark implementation complete

**This is mandatory.** After implementation is complete:

1. Update `.pi/work.settings.json`: set `"phase": "auto-verify"`
2. Append to `_notes/worklog.md`: `- YYYY-MM-DD HH:MM: Implementation complete`

**Do NOT present results or ask the user anything.** The extension will run an automatic review. Just update the files and stop.

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
