# Verify Phase (user reviews implementation)

Verify phase. The user reviews implementation results and decides next steps.

## Context

You just completed the implement phase. All changes are in the working tree.
The user will now review your work against the acceptance criteria.

## Step 1: Show summary

Present a compact summary:
1. **What was done** — list of changes (files modified, tests added/updated)
2. **Acceptance criteria status** — check each criterion from `_notes/plan.md`
3. **Test results** — pass/fail summary from the last test run
4. **Open issues** — anything incomplete or uncertain

## Step 2: Wait for user feedback

The user may:
- **Approve** — all criteria met, move to `/work:done`
- **Request changes** — specific feedback on what to fix or redo
- **Reject** — fundamental issues, needs replanning

## Step 3: Route feedback

- If approved: suggest `/work:done` then `/work:pr`
- If changes requested or rejected: suggest `/work:plan` to return to planning with the feedback

**Important:** From verify, you can ONLY go back to **plan**. Never to implement directly.
The user must go through plan to refine requirements before another implement cycle.

## Allowed transitions

- verify → plan (always allowed)
- verify → done (if all criteria pass)

Do NOT suggest transitioning to implement or research from verify.

Append to `_notes/worklog.md`: `- YYYY-MM-DD HH:MM: <action summary>`

## Autoresearch rules

**Eval checklist:**
1. Did the summary include all four required sections (changes, criteria status, test results, open issues)?
2. Was every acceptance criterion from the plan explicitly listed with pass/fail status?
3. Did the agent wait for user feedback before taking any action?
4. Were user change requests correctly interpreted (not executed as new TODOs)?

**Test inputs:**
- "Verify implementation where all criteria pass"
- "Verify implementation where user requests 2 specific changes"
- "Verify implementation where user rejects and wants replanning"

**Can change:** summary format, criteria presentation, feedback interpretation rules
**Cannot change:** user controls all decisions, can only transition back to plan, no code changes allowed
**Min sessions before eval:** 5
**Runs per experiment:** 3
