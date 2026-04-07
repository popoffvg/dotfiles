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

You are working in the **current branch/repository** (no worktree).

- Make code changes in the current repository.
- Use `_notes/` (plan.md, worklog.md) for planning/logging.
- Commit directly on the current branch.

## Step 1: Read the plan

Read `_notes/plan.md` for the TODO list. Read `_notes/research-*.md` for additional context.

## Step 2: Execute TODOs in order

For each unchecked `- [ ]` TODO in `_notes/plan.md`:
1. **Read full files first.** Before editing any file, read it entirely. Note file-level constraints (strict modes, build tags, linter directives, error handling conventions). Your edits must be consistent with these constraints.
2. **Plan all edits before touching any file.** Identify every function, type, and section you need to change across all files. Write out the full list mentally. Then make all changes in a single pass per file — do NOT make a partial edit, run tests, then edit again. Piecemeal edits to the same file cause thrashing.
3. Implement the change described
4. **Run static analysis** on changed files before testing. Use the appropriate language-specific linter/checker for the file type. Fix all errors before proceeding.
5. Run relevant tests for that TODO
6. If tests fail, fix and **re-test** until passing. **If you have edited the same file 3+ times without passing tests, stop.** Describe what is blocking to the user and wait for guidance — do not keep making speculative edits.
7. Verify the TODO is fully satisfied (code + tests)
8. If test coverage is narrow/insufficient for the change, note that in `_notes/worklog.md` and tell the user manual verification is required
9. **Stage changes** with `git add` for the files you changed
10. **Launch subagent review.** Call the `subagent` tool:
   ```
   agent: "work-reviewer"
   task: "Review the staged changes for this TODO:\n\nTODO: <todo text>\n\nStaged diff:\n```diff\n<output of git diff --cached>\n```\n\nPlan context: <relevant acceptance criteria>"
   ```
   - If the reviewer says **BLOCKED**: fix the issues, re-stage, and re-run the reviewer.
   - If the reviewer says **APPROVED**: proceed to the next step.
11. If `approveCommits` is enabled in settings: **Ask the user for approval before committing.** Show: TODO text, changed files, test results, and **reviewer verdict**. Wait for explicit "yes"/"ok"/"approve". If rejected — fix and ask again (re-run reviewer after fixes).
12. **Commit the changes** with a meaningful message referencing the TODO (commit only after steps 1–11 are complete)
13. Check off the TODO: `- [ ]` → `- [x]`
14. Log what was done to `_notes/worklog.md`
15. **Call `work_compact`** with a brief summary of what was completed — this frees context space and re-injects the plan so you stay oriented
16. Continue to the next TODO

**IMPORTANT: Call `work_compact` after each TODO.** Long implementation sessions accumulate tool calls, file reads, and test output that consume context. Compaction discards this noise and re-injects the current plan + worklog, keeping you focused on remaining work.

**Each TODO = one git commit.** Commit only after implementation + tests + re-tests + **subagent review approval** confirm the TODO is done. Follow the `work-commit` skill for commit message format:
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

**You may ONLY check off TODOs in `_notes/plan.md`.**
- ✅ Allowed: `- [ ]` → `- [x]` (check off completed TODOs)
- ❌ Forbidden: adding new TODOs, removing TODOs, rewriting TODO text, editing descriptions, modifying Design Decisions, adding headers, adding blank lines, changing indentation, reformatting any content
- The file must be byte-for-byte identical except for `[ ]` → `[x]` substitutions
- If a TODO is unclear or wrong, **do NOT fix the plan** — ask the user for clarification

## Execution rules

- **NEVER skip a TODO.** If a TODO is unclear, blocked, or you can't figure out how to do it — **ask the user**. Do not skip it, do not log it as SKIP, do not move on. Wait for the user's answer.
- **Work autonomously** — don't ask for permission on routine decisions.
- **DO ask the user** when you need approval for risky changes, unclear requirements, or missing details. Examples: deleting data, changing public APIs, ambiguous TODOs, picking between fundamentally different approaches.
- **Defend technical decisions before switching.** When the user questions a design choice (format, approach, algorithm), present trade-offs of 2–3 alternatives instead of immediately switching. Only change after the user picks an option. Premature capitulation causes churn.
- **If a tool returns a permission/access error**, ask the user for help instead of retrying blindly.
- **If blocked on something minor**, try a reasonable workaround and log the decision in worklog.

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

1. Update `.pi/work.settings.json`: set `"phase": "auto-verify"`
2. Append to `_notes/worklog.md`: `- YYYY-MM-DD HH:MM: Implementation complete`

**Do NOT present results or ask the user anything.** The extension will run an automatic review. Just update the files and stop.
