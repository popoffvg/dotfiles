---
name: plan
description: >
  Plan phase for atom workflow. Guides LLM to produce a structured _notes/plan.md
  with acceptance criteria and TODOs. Never executes — only plans.
  Use when entering plan phase, after /atom:init, or when /atom:recall shows phase=plan.
---

# plan

## CRITICAL RULES

**You are a planner, not an executor.**

**Always load and apply `sudolang-plan` when writing or refining plans.**
- Translate decisions, constraints, invariants, and TODO logic into concise SudoLang-style structure.
- Keep final `_notes/plan.md` readable Markdown, but express logic with SudoLang conventions (constraints/interfaces/commands/invariants).

- **DO NOT** write code, edit files, run tests, install packages, or make any changes outside `_notes/`.
- **DO NOT** treat user messages as tasks to execute. Everything the user says is input for the plan.
- User says "add auth endpoint" → add it as a TODO, don't create the endpoint.
- User says "fix the bug in handler.go" → add it as a TODO, don't open the file and fix it.
- You may create/edit `_notes/plan.md` and `_notes/worklog.md` ONLY.
- You may READ any file to understand the codebase for planning purposes.

## Phase Flow

```
plan → /work:implement → auto-verify → verify → /work:plan → ...
```

## Step 1: Assess current state

Check if this is:
- **First planning** — no existing `_notes/plan.md` content (only scaffold from `/atom:init`)
- **Iteration after verify** — feedback from user, worklog has implementation history
- **Return from research** — `_notes/research-*.md` files exist with findings

If iterating:
1. Read `_notes/worklog.md` for what was attempted
2. Read user feedback (at the end of this prompt)
3. Identify what needs to change in the plan

Before writing or rewriting major plan sections, run a **Decision Freeze Check**:
- List key architectural decisions required for this work.
- Split them into:
  - **Fixed Decisions** (final)
  - **Open Questions** (not final)
- If any decision is still open, ask targeted clarifying questions first.
- Do not formalize detailed specs/tasks until critical decisions are fixed.

## Step 2: Read context

Read all `_notes/*.md` files for current state.
You may also READ source files to understand the codebase — but never modify them.

If `_notes/research-*.md` files exist, incorporate their findings into the plan.

While reading, collect **implementation guidelines**: coding patterns, naming conventions, test styles, or project rules the implementer must follow. You will write these into the plan in Step 3.

## Step 3: Build / refine the plan

Write everything to a single file `_notes/plan.md`. The plan is a TODO list.

**Every Acceptance Criteria and TODO entry must be a `- [ ]` checkbox.** This is the contract with the implement phase — it can only check off TODOs, not change the plan text.

### Plan structure

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
- <e.g. "tests use helper transactions with retry on conflict">

### References
Existing files or docs that demonstrate the expected style:
- `<path/to/example_file>` — reference implementation for <pattern>
- `<path/to/test_file>` — shows expected test structure

> If no project-specific patterns were found, write "No project-specific guidelines identified — follow language defaults and loaded skills."

## Acceptance Criteria
- [ ] Auth endpoint returns 401 for expired tokens
- [ ] Refresh token rotation works with Redis TTL
- [ ] SDK client handles token refresh transparently
- [ ] Integration tests pass for all auth flows

## TODOs
- [ ] Add refresh endpoint to `core/pl/pkg/auth/handler.go`
  - endpoint path: POST /auth/refresh
  - ```pseudo
    func HandleRefresh(w, r)
      body = decode(r.Body) -> RefreshRequest
      if body.Token == "" -> 400
      pair, err = tokenService.Refresh(body.Token)
      if err == ErrExpired or ErrNotFound -> 401
      respond(w, 200, pair)
    ```
  - edge cases:
    - empty body → 400, not panic
    - malformed JSON → 400 with message
    - expired refresh token → 401
- [ ] Implement token rotation in `core/pl/pkg/auth/token.go`
  - ```pseudo
    func (s *Service) Refresh(token string) -> (TokenPair, error)
      stored = s.store.Get(token)
      if stored == nil -> return ErrNotFound
      if stored.Expired() -> s.store.Delete(token); return ErrExpired
      newPair = s.generate(stored.UserID)
      s.store.Delete(token)
      s.store.Set(newPair.Refresh, TTL)
      return newPair
    ```
  - edge cases:
    - concurrent refresh with same token → only first succeeds
    - refresh token valid but user deleted → error, not new tokens
    - store unavailable (Redis down) → 500, not silent failure
- [ ] Update SDK client in `core/platforma/sdk/src/auth.ts`
  - transparent refresh on 401 response
  - retry original request after refresh
  - edge cases:
    - refresh itself returns 401 → surface error, don't retry infinitely
    - concurrent requests during refresh → queue, don't fire N refreshes
- [ ] Add integration tests in `core/pl/pkg/auth/handler_test.go`
  - test expired token → 401
  - test valid refresh → new tokens
  - test rotation invalidates old token

## Repos
- repo: .
  branch: <current branch>

## Work Notes
- `_notes/worklog.md` — progress log

## Decisions Log

- D1: <short decision statement>
  - status: fixed
  - rationale: <why>
  - trade-offs: <pros/cons>

## Open Questions
- Q1: <question that blocks detailed planning>
  - owner: <user/agent>
  - needed by: <TODO ID or milestone>
```

**Plan MUST have both Acceptance Criteria and TODOs.** Do not signal readiness until both sections are filled.

- **Acceptance Criteria** — testable conditions for "done" (what the result looks like)
- **TODOs** — concrete implementation steps (how to get there)
- **Decisions Log** — single source of truth for fixed decisions (use IDs like D1, D2)
- **Open Questions** — unresolved decisions that block detailed planning

If a TODO depends on an unresolved question, mark it explicitly (e.g., `depends on Q1`) instead of guessing.

### Rules for TODOs

- Each TODO is a concrete, implementable task
- Sub-items under a TODO provide details, not separate tasks
- TODOs are ordered by execution sequence
- Each TODO references specific files where changes happen
- Each TODO references relevant fixed decision IDs when applicable (e.g., `decisions: D1, D3`)
- No vague TODOs like "improve performance" — be specific
- **Each TODO = one git commit.** Design TODOs so each one is a self-contained, committable unit of work. Don't make TODOs too large (multiple unrelated changes) or too small (not worth a commit).

### Clarification-first behavior

Ask clarifying questions instead of guessing when:
- task granularity is unclear (too broad vs too fine)
- architecture choices are not finalized
- user asks for formalism but value is uncertain
- user reply is terse/ambiguous (e.g. "1", "2", "yes", "do it", "commit") and could map to multiple actions

Prefer 1–3 focused questions, then update the plan.
When the user replies with a numeric choice, restate the selected option in one sentence before editing the plan.

For a bare "commit" in plan phase:
- Do not run git commit.
- Ask whether they mean "commit to this direction" (record a decision/TODO) or "create a git commit".
- If they mean git, remind them plan phase is planning-only and continue refining `_notes/plan.md`.

### Pseudocode and edge case tests

**Every TODO that introduces or changes a function MUST include:**

1. **Pseudocode** — show the function signature and core logic flow. Not real code, but enough for the implementer to understand intent without guessing.
2. **Edge case tests** — list 2–5 small test cases that cover boundaries, error paths, and non-obvious inputs.

Example:

```markdown
- [ ] Add token refresh in `pkg/auth/handler.go`
  - file: `pkg/auth/handler.go`
  - ```pseudo
    func RefreshToken(req RefreshRequest) -> (TokenPair, error)
      token = store.Get(req.RefreshToken)
      if token == nil or token.Expired() -> return ErrInvalidToken
      newPair = generateTokenPair(token.UserID)
      store.Delete(req.RefreshToken)       // rotate: old token dies
      store.Set(newPair.RefreshToken, TTL)
      return newPair
    ```
  - edge cases:
    - expired refresh token → 401, old token removed from store
    - missing refresh token (empty string) → 400, not 500
    - concurrent refresh with same token → only first succeeds, second gets 401
    - refresh token valid but user deleted → 401
```

**When pseudocode is NOT needed:**
- Config/wiring TODOs (e.g. "add route to router", "update Dockerfile")
- Pure deletion TODOs (e.g. "remove deprecated endpoint")
- Documentation-only TODOs

**When edge case tests are NOT needed:**
- TODOs that only move/rename things
- TODOs that wire existing functions together without new logic

### Formalism policy (default: inline invariants, no separate spec file)

For stateful TODOs, default to:
- pseudocode for transition logic
- explicit invariants as bullets/assertions in the same TODO

Do **not** create a separate `.qnt` spec by default. Avoid duplicating logic across multiple docs.

Use Quint only when **all** are true:
1. The problem has real concurrency/ordering complexity (not a simple bounded retry loop).
2. The team will actually run `quint typecheck`/`quint verify` in this repo.
3. The user explicitly wants formal spec work.

If any condition is false, keep formal content inline as pseudocode + invariants.

Before introducing Quint, ask:
- "Do you want Quint here for executable verification, or are inline invariants sufficient?"

## Step 4: Append to worklog

Append to `_notes/worklog.md`: `- YYYY-MM-DD HH:MM: <action summary>`

## Step 5: Signal readiness

When the plan has both **Acceptance Criteria** and **TODOs** filled, and no critical unresolved questions:
```
Plan is ready. Run `/work:implement` to begin autonomous implementation.
```

**Do NOT signal readiness if Acceptance Criteria is missing OR critical Open Questions remain.**

If unknowns surface:
```
Unknowns found: <list>. Clarifications/research needed before planning can continue.
```

## Interpreting user input

| User says | You do |
|-----------|--------|
| "add X feature" | Add as TODO with sub-items for details |
| "fix bug in Y" | Add as TODO, note the file/location |
| "use approach Z" | Record in Decisions Log (with a new D# entry) |
| "what about X?" | Discuss, then update plan if agreed |
| "looks good" | Confirm plan is ready, suggest `/work:implement` |
| "change the order" | Reorder TODOs |

**Every user message refines the plan. Nothing gets executed.**

## Phase transitions from plan

- `plan → implement`: User runs `/work:implement`. Never transition manually.
- `plan → research`: If unknowns found, suggest user switch to research.
- `plan → todo`: User runs `/work:todo` for ad-hoc chat.

## Autoresearch rules

**Eval checklist:**
1. Does the plan have a filled `Implementation Guidelines` section (skills + patterns or explicit "none")?
2. Were zero code changes or file edits made outside `_notes/`?
3. Does every TODO have acceptance criteria that can be verified independently?
4. Does the plan include both Acceptance Criteria and TODOs sections?
5. Were user messages interpreted as plan input (not executed as tasks)?

**Test inputs:**
- "Plan a multi-service auth system with JWT + refresh tokens"
- "Add auth endpoint" (should become a TODO, not get executed)
- "Iterate on plan after verify feedback: tests were too narrow"

**Can change:** plan template, TODO format, criteria examples, design decision format
**Cannot change:** read-only enforcement (no code changes), plan location (_notes/plan.md), checkbox contract
**Min sessions before eval:** 5
**Runs per experiment:** 3
