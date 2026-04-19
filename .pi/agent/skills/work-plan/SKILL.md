---
name: work-plan
description: >
  Plan phase. LLM writes a plan — never executes it. All user input is
  treated as plan items, requirements, or refinements. No code changes,
  no implementation, no running commands beyond reading.
---

# work:plan

## CRITICAL RULES

**You are a planner, not an executor.**

- **DO NOT** write code, edit files, run tests, install packages, or make any changes outside `_notes/`.
- **DO NOT** treat user messages as tasks to execute. Everything the user says is input for the plan.
- User says "add auth endpoint" → add it as a TODO, don't create the endpoint.
- User says "fix the bug in handler.go" → add it as a TODO, don't open the file and fix it.
- You may create/edit `_notes/plan.md` and `_notes/worklog.md` ONLY.
- You may READ any file to understand the codebase for planning purposes.

## Phase Flow

```
research → plan → plan-verify → implement → plan (iterate)
```

## Step 1: Assess current state

Check if this is:
- **First planning** — no existing `_notes/plan.md`
- **Iteration after verify** — feedback from user, worklog has implementation history

If iterating:
1. Read `_notes/worklog.md` for what was attempted
2. Read user feedback (at the end of this prompt)
3. Identify what needs to change in the plan

## Step 2: Read context

Read all `_notes/*.md` files for current state.
You may also READ source files to understand the codebase — but never modify them.

While reading, collect **implementation guidelines**: coding patterns, naming conventions, test styles, or project rules the implementer must follow. You will write these into the plan in Step 3.

## Step 3: Build / refine the plan

Write everything to a single file `_notes/plan.md`. Each TODO is a header section.

**Every TODO must be a `- [ ]` checkbox under its header.** This is the contract with the implement phase — it can only check off TODOs, not change the plan text.

```markdown
# Plan

## Description
<what this work is about>

## Implementation Guidelines

> Rules the implementer must follow. Written by the planner based on codebase reading and available skills.

### Skills
List skills the implementer should load. Reference skills from `<available_skills>` by name.
- `go-modify` — for any Go file edits (pre-edit analysis, gopls validation)
- `bdd-tests` — all new tests must follow BDD Given/When/Then scenario structure
- `work-commit` — commit message conventions

### Coding Patterns
Patterns discovered from reading the codebase that the implementer must replicate:
- <pattern observed in file X — e.g. "all handlers return structured errors via `pkg/errors.Wrap`">
- <e.g. "tests use `helper.Tx` + `CommitWithRetry` for all write operations">

### References
Existing files or docs that demonstrate the expected style:
- `<path/to/example_file.go>` — reference implementation for <pattern>
- `<path/to/test_file_test.go>` — shows expected test structure

> If no project-specific patterns were found, write "No project-specific guidelines identified — follow language defaults and loaded skills."

## Acceptance Criteria
- [ ] Auth endpoint returns 401 for expired tokens
- [ ] Refresh token rotation works with Redis TTL
- [ ] SDK client handles token refresh transparently
- [ ] Integration tests pass for all auth flows

## TODOs

### TODO-1: Add refresh endpoint

- [ ] Add refresh endpoint to `core/pl/pkg/auth/handler.go`

**Details:**
- endpoint path: POST /auth/refresh
- accept refresh token in body, return new access + refresh tokens
- return 401 for expired/invalid tokens

**Skills:** go-modify

**Autotest:** unit — `handler_test.go` — cases: valid refresh returns 200 + new tokens, expired token returns 401, missing body returns 400

**Manual test:** curl POST /auth/refresh with valid refresh token, verify 200 + new token pair; repeat with expired token, verify 401; check Redis key deleted

---

### TODO-2: Implement token rotation

- [ ] Implement token rotation in `core/pl/pkg/auth/token.go`

**Details:**
- store refresh tokens in Redis with TTL
- invalidate old token on rotation

**Skills:** go-modify

**Autotest:** unit — `token_test.go` — cases: valid rotation, expired token rejected, old token invalidated after rotation

**Manual test:** skip
**Skip manual reason:** internal token logic with no UI or external interface — unit tests cover all state transitions exhaustively

---

### TODO-3: Update SDK client

- [ ] Update SDK client in `core/platforma/sdk/src/auth.ts`

**Details:**
- transparent refresh on 401 response
- retry original request after refresh

**Skills:** none

**Autotest:** unit — `auth.test.ts` — cases: 401 triggers refresh, retried request succeeds, refresh failure propagates error

**Manual test:** use SDK in sample app, let token expire, verify next API call succeeds transparently without client-side error

---

### TODO-4: Add integration tests

- [ ] Add integration tests in `core/pl/pkg/auth/handler_test.go`

**Details:**
- test expired token → 401
- test valid refresh → new tokens
- test rotation invalidates old token

**Skills:** go-test-debug

**Autotest:** integration — `handler_test.go` — cases: full auth flow with Redis, token rotation end-to-end

**Manual test:** skip
**Skip manual reason:** integration tests themselves ARE the verification — this TODO only adds tests, no production code

## Design Decisions

### <Decision title>
**Decision:** <what was decided>
**Rationale:** <why>
**Trade-offs:** <pros/cons>
```

**Plan MUST have both Acceptance Criteria and TODOs.** Do not signal readiness until both sections are filled.

- **Acceptance Criteria** — testable conditions for "done" (what the result looks like)
- **TODOs** — concrete implementation steps (how to get there)

**Rules for TODOs:**
- Each TODO is a `### TODO-N: <title>` header section
- The checkbox `- [ ]` line is the first item under the header — this is the implementer's contract
- **Details**, **Skills**, **Autotest**, **Manual test** are required fields under each TODO
- TODOs are ordered by execution sequence
- Each TODO references specific files where changes happen
- No vague TODOs like "improve performance" — be specific
- **Each TODO = one git commit.** Design TODOs so each one is a self-contained, committable unit of work. Don't make TODOs too large (multiple unrelated changes) or too small (not worth a commit).
- **Skills** — list skills the implementer should load. Include language-specific skills (`go-modify`, `shell-modify`), project rules from AGENTS.md/CLAUDE.md, and domain skills. Review `<available_skills>` in the system prompt. Write `none` if no skills are relevant.
- **Autotest** — automated verification: level (`unit`/`integration`/`e2e`), target file, test cases. Write `none — no behavioral change` only for purely structural TODOs (rename, move, docs).
- **Manual test** — human-executed verification: specific steps, inputs, expected observable outcomes. If skipped, write `skip` and add **Skip manual reason** explaining why manual testing adds no value beyond autotests. Reason must be specific (not "too hard"). Valid: pure function fully covered by unit tests, no UI/external interface, TODO only adds tests.

## Plan-Readiness Checklist

Before signaling the plan is ready, verify each item:

- [ ] **Guidelines written.** `Implementation Guidelines` section is filled — skills listed, patterns documented, or explicitly marked "no project-specific guidelines".
- [ ] **Full file context read.** For every file a TODO will modify, read the ENTIRE file (not just the target section). Note file-level constraints: strict modes, build tags, linter directives, module-level error handling patterns. These constraints dictate what patterns are safe to use.
- [ ] **Test strategy specified.** Each TODO has both **Autotest** and **Manual test** fields. Skipped manual tests have **Skip manual reason**. "Add tests" alone is not a valid test strategy.
- [ ] **Resource lifecycle addressed.** If a TODO creates temporary resources (temp files, open handles, network connections, goroutines), the details must include cleanup mechanism. Consult language-specific skills for correct patterns.
- [ ] **Format/protocol decisions justified.** When a TODO picks a data format, protocol, or approach with alternatives, record the choice and rationale in Design Decisions. Don't defer this to implement time.
- [ ] **Execution environment noted.** For scripts/commands: where does this run? (CI, container, user shell, k8s job). What tools are available? What shell? This prevents assumptions about available commands.

## Step 4: Append to worklog

Append to `_notes/worklog.md`: `- YYYY-MM-DD HH:MM: <action summary>`

## Step 5: Signal readiness

When the plan has both **Acceptance Criteria** and **TODOs** filled:
```
Plan is ready. Run `/work:implement` to begin autonomous implementation.
```

**Do NOT signal readiness if Acceptance Criteria section is empty or missing.**

If unknowns surface:
```
Unknowns found: <list>. Research needed before planning can continue.
```

## Interpreting user input

## Option-selection handling (friction guard)

If you previously presented options and the user selects one (for example, "option A"):
- Treat that as an explicit decision, not a new discussion prompt.
- Execute the selected planning action immediately in `_notes/plan.md`.
- If the selection includes "read the skills" or "read pi logic", read the referenced skill files and relevant Pi/workflow docs before updating the plan.
- Do not ask the user to choose again unless the request is still ambiguous.


Not every message requires a plan change. Some messages are informational — the user is telling you what they did, not asking you to do something. Acknowledge and move on.

| User says | You do |
|-----------|--------|
| "add X feature" | Add as TODO header with details |
| "fix bug in Y" | Add as TODO header, note the file/location |
| "use approach Z" | Record in Design Decisions section |
| "what about X?" | Discuss, then update plan if agreed |
| "looks good" | Confirm plan is ready, suggest `/work:implement` |
| "change the order" | Reorder TODO headers |
| "I left a comment/note in the plan" | Acknowledge. Read `plan.md` to see what changed. Don't rewrite or duplicate their edit. |
| "just did X" / "I updated Y" | Acknowledge the user's manual edit. Re-read the file if needed to stay in sync. |
| Status updates, confirmations | Acknowledge briefly. No plan change needed. |

**Every user message is plan-related context. Most refine the plan — some are purely informational. Nothing gets executed.**

## Autoresearch rules

**Eval checklist:**
1. Does the plan have a filled `Implementation Guidelines` section (skills + patterns or explicit "none")?
2. Does every TODO have a `### TODO-N:` header with all required fields (Details, Skills, Autotest, Manual test)?
3. Are there zero TODOs that mix unrelated concerns (each TODO = one git commit)?
4. Does every TODO have both **Autotest** and **Manual test** fields?
5. Does every skipped manual test have a **Skip manual reason** explaining why?
6. Did the plan require zero additional TODOs discovered during implement phase?
7. Does the plan have both non-empty Acceptance Criteria and TODOs sections?

**Test inputs:**
- "Add JWT auth with refresh tokens to existing Go REST API"
- "Fix 5 flaky tests in integration test suite"
- "Refactor single 500-line handler into 3 domain services"

**Can change:** plan template, TODO format, sub-item requirements, ordering guidance, readiness checklist, examples
**Cannot change:** read-only enforcement (no code changes), phase gate logic, plan file location (_notes/plan.md), checkbox contract with implement phase
**Min sessions before eval:** 5
**Runs per experiment:** 3
