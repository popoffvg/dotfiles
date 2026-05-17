---
name: work-todo-prepare
description: >
  Author `<notes-dir>/todos/TODO-N.md` files so a low-reasoning implementer
  (dummy Sonnet) can execute them mechanically. Defines the TODO file
  template, required sections, and rules that remove ambiguity. Use
  whenever creating or rewriting a TODO file during the plan phase.
---

# work-todo-prepare

## Audience

**A dummy Sonnet implementer with no project context, no judgment, and no permission to improvise.**

If the implementer has to *infer* anything — a file path, a function name, a test command, a decision — the TODO is broken. Rewrite it.

## Operating principles

1. **Concrete over abstract.** Real paths, real commands, real signatures. No "etc.", "and similar", "as needed".
2. **No vague verbs.** Ban: *improve, handle, refactor stuff, clean up, make better*. Replace with: *rename X to Y, add field Z to type T, delete function F*.
3. **Every section is a checklist the implementer can tick off.** If a section is prose, convert it to bullets or a code block.
4. **One TODO = one commit.** Group related edits; don't split into micro-commits or bundle unrelated work. >8 files → ask the user before writing the TODO.
5. **Pseudocode is the spec.** Use TS pseudocode per `work-plan-flow`. The implementer translates; they do not invent.
6. **No outward links.** Don't reference plan-level Goal, AC-IDs, or other TODOs except via the explicit `Depends on` field.
7. **Pre-reads are mandatory.** Every file the implementer must understand before editing goes in `Pre-reads`. Missing pre-reads → wrong assumptions.
8. **New terms are described, not assumed.** If the TODO uses a domain term (entity, command, event, component) that is not already in `plan.md`'s Terms table, the TODO must define it before first use *and* the term must be added to `plan.md`'s Terms table in the same planning pass. The implementer never has to guess what a name means.
9. **Interface changes are shown as a git diff.** Any modification to a public interface — function signature, method set, struct/record fields, enum variants, gRPC/HTTP/CLI surface — appears in the TODO as a unified-diff block (`-` old lines, `+` new lines). New interfaces are written out **in full** (every field, every method, every doc comment) so the implementer copies, not invents.

## File location

`<notes-dir>` is the work-manager notes directory for the current task (commonly `_notes/`). Resolve it from the active phase context; do not hardcode `_notes/` inside this skill.

- Path: `<notes-dir>/todos/TODO-N.md`, where `N` is 1-indexed and contiguous.
- One file per TODO. Bodies never live in `<notes-dir>/plan.md`.
- Linked from the `<notes-dir>/plan.md` index as `- [ ] **TODO-N** — <title> → [todos/TODO-N.md](todos/TODO-N.md)`.

## Required sections (in order)

Every TODO file MUST contain these sections, in this order, with these exact headings:

1. `# TODO-N: <title>` — H1
2. `**Type:**` line
3. `**Depends on:**` line
4. `## Outcome`
5. `## Files`
6. `## Pre-reads (MUST read before editing)`
7. `## Skills to load`
8. `## Changes`
9. `## Autotest`
10. `## Manual test`
11. `## Commit`
12. `## Definition of done`

Missing any section → invalid TODO.

## Template

```markdown
# TODO-N: <imperative title, ≤ 60 chars>

**Type:** workflow | state machine | component | event handler | data shape change
**Depends on:** TODO-M (must be checked off first) | none

## Outcome
<Capability statement in use-case language, using only `plan.md` Terms. Format: "<actor> can <capability>" or "<aggregate> emits <event> when <command> succeeds". No file paths, no type names, no implementation vocabulary. See `work-todo-prepare` § Outcome.>

## Files
- `pkg/auth/handler.go` — modify
- `pkg/auth/token.go` — modify
- `pkg/auth/handler_test.go` — create

## Pre-reads (MUST read before editing)
- `pkg/auth/middleware.go` — existing token validation
- `pkg/redis/client.go` — Redis helpers used here

## Skills to load
- `go-modify`
- `work-commit`

## Changes

TS pseudocode — follow `work-plan-flow`. One snippet, ≤ 40 lines, all side effects + error paths visible.

```ts
type RefreshRequest = { token: string }
type TokenPair = { access: string; refresh: string }

function refresh(req: RefreshRequest): TokenPair | 401 {
  const session = redis.get(`auth:${req.token}`)
  if (!session || session.expiresAt < now()) return 401

  const pair = mintTokens(session.userId)
  redis.del(`auth:${req.token}`)
  redis.set(`auth:${pair.refresh}`, session, TTL)
  return pair
}
```

## Autotest
- **Level:** unit | integration | e2e
- **Target files:** `pkg/auth/handler_test.go`, `pkg/auth/token_test.go`
- **Cases:**
  - valid refresh returns 200 + new token pair
  - expired refresh returns 401
  - rotation deletes old Redis key
- **Command:** `go test ./pkg/auth/...`
- **Expected:** all pass, no new lint warnings

## Manual test
- **Steps:**
  1. `make run-dev`
  2. `curl -X POST localhost:8080/auth/refresh -d '{"token":"<valid>"}'`
  3. `curl -X POST localhost:8080/auth/refresh -d '{"token":"<expired>"}'`
- **Expected:**
  1. 200 with new `{access, refresh}` pair
  2. 401, Redis key `auth:<old>` absent (`redis-cli get auth:<old>` → nil)
- **Skip?** no (or: `skip — reason: <specific>`)

## Commit
- **Prefix:** feat | fix | refactor | chore | docs | test
- **Subject:** `feat: rotate refresh tokens on /auth/refresh`
- ≤ 72 chars, imperative, no period.

## Definition of done
- [ ] All files in **Files** modified/created as specified
- [ ] Autotest command passes
- [ ] Manual test steps produce **Expected** outcomes
- [ ] No edits outside **Files** without logging in `worklog.md`
- [ ] Commit created with the message above
```

## Section rules

### Type
Pick exactly one. The Type determines the pseudocode pattern in `## Changes`:

| Type | `## Changes` pattern |
|------|----------------------|
| workflow | function with sequential ops, branches, return value |
| state machine | `transition(state, event)` over discriminated-union state |
| component | `interface` + class skeleton + wire-up snippet |
| event handler | async handler with `switch` on event type |
| data shape change | before / after TS types |

### Depends on
- `none` — TODO can start immediately.
- `TODO-M` — TODO-M must be `[x]` in `plan.md` before starting.
- Multiple deps allowed: `TODO-2, TODO-3`.
- No forward references (TODO-3 cannot depend on TODO-5).

### Outcome

**Capability statement, not an implementation summary.**

Outcome answers *"what new can the system do once this TODO lands?"* in **use-case language**, using only terms already in `plan.md`'s Terms table (or this TODO's `## New terms`).

Rules:
- Use case-style phrasing: `<actor> can <capability> [when <condition>]` or `<aggregate> emits <event> when <command> succeeds`. Present tense, active voice.
- Refer to entities, commands, events, and actors by their Terms-table names — verbatim.
- **No implementation vocabulary.** Banned: file paths, function/struct names, HTTP routes, package names, libraries, "add a field", "create a function", "introduce a struct", "wire up", "in `pkg/...`".
- One or two sentences. If you need more, the TODO is too big — split.
- Do not restate the plan-level Goal. Outcome is scoped to *this* TODO's slice of capability.

**Good** (uses Terms, describes capability):
- "A `User` can issue `RotateToken`; on success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid."
- "An `Admin` can issue `RevokeSession`, after which the `Session` rejects every further `RotateToken` with `AuthRefreshFailed`."

**Bad** (implementation leaks):
- "Add a `/auth/refresh` handler in `pkg/auth/handler.go` that calls Redis to rotate the token." → mentions path, package, infra.
- "Introduce a `RefreshRequest` struct and return `TokenPair`." → talks about types, not capability.
- "Wire up the new endpoint." → vague + implementation-flavoured.

If the TODO is purely structural (e.g., a refactor that adds no capability), state that explicitly: *"No new capability; reshapes the existing `Session` aggregate so future `RotateToken` variants share a common path."* The shape change still has to be expressed in Terms, not file paths.

### New terms

If this TODO introduces any domain term not already in `plan.md`'s Terms table, add a `## New terms` section immediately after **Outcome** with one row per new term:

```markdown
## New terms

| Term | Kind | Description |
|------|------|-------------|
| TokenJar | entity | Per-user container holding active refresh tokens; bounded to 5 entries, LRU-evicted |
| EvictToken | command | Issued by TokenJar when capacity exceeded; emits `TokenEvicted` |
```

Rules:
- Kind ∈ same set as `plan.md` Terms (`entity | value-object | aggregate | component | service | policy | state | command | event`).
- Description is one sentence with the visible contract (TTL, bounds, error semantics) — same bar as `plan.md` Terms.
- Every new term must also be added to `plan.md`'s Terms table in the same planning pass; the TODO copy exists so the implementer doesn't have to context-switch.
- If no new terms: omit the section entirely. Do **not** write `## New terms\nnone`.

### Files
- Every file the implementer will touch. Use repo-relative paths.
- Action per file: `create | modify | delete | rename → <new path>`.
- No globs. No "and related files".

### Pre-reads
- Every file the implementer must read first to avoid wrong assumptions.
- Include reason: `path — why`.
- Tests, callers, neighboring patterns are common pre-reads.
- If `none`, write `none — reason: <specific>` (e.g., "creating a new package, no existing files to align with").

### Skills to load
- Skill names only, no paths. Example: `go-modify`, `work-commit`, `proto-change`.
- If `none`, write `none`.

### Changes
- TS pseudocode per `work-plan-flow`.
- One fenced ` ```ts ` block. ≤ 40 lines.
- All side effects + error paths visible.
- No real imports, no real file paths inside the snippet.
- For multi-file changes: still one snippet describing the *behavior*; the **Files** section maps it to real paths.

#### Interface changes (sub-section)

If this TODO modifies or adds a public interface, include an **Interface** sub-block **inside `## Changes`**, before the TS pseudocode, in one of two forms:

**Modification — use unified git-diff format** in the file's real language (Go, TS, Proto, etc.), so the implementer can apply it verbatim:

````markdown
**Interface change — `pkg/auth/handler.go`:**

```diff
-func Refresh(ctx context.Context, token string) (string, error)
+func Refresh(ctx context.Context, req RefreshRequest) (TokenPair, error)
```
````

Rules for the diff:
- Real file path in the heading. Real language syntax inside the fence.
- Include enough surrounding lines for unambiguous application (≥1 line of context if the symbol is overloaded).
- One diff block per file. Group all changes to that file into the same hunk.
- For renames: show old → new path in the heading and use a `diff` block per file.

**New interface — write it out in full** in the file's real language. Every field, method, doc comment, error type the caller can observe must appear. The implementer copies; they do not design.

````markdown
**New interface — `pkg/auth/types.go`:**

```go
// RefreshRequest is the body of POST /auth/refresh.
type RefreshRequest struct {
    Token string `json:"token"` // opaque refresh token issued by /auth/login
}

// TokenPair is returned on successful refresh.
type TokenPair struct {
    Access  string `json:"access"`  // JWT, 15 min TTL
    Refresh string `json:"refresh"` // opaque, 30 day TTL, rotates each refresh
}
```
````

Rules for new interfaces:
- Include all fields/methods. No `// ...` or "and the rest" placeholders.
- Document every field/method with its visible contract (TTL, units, nullability, error semantics).
- If multiple files define the new surface, one fenced block per file.

The TS pseudocode that follows describes *behavior*; the Interface sub-block defines the *shape*. Both are required when the surface changes.

### Autotest
- `Level` is required: `unit | integration | e2e | none`.
- `none` is only valid for non-behavioral changes (pure rename, doc edit). Justify in one line.
- `Command` MUST be a single runnable shell command. No "run the relevant tests".
- `Cases` are bullet points; each one a single sentence with input → expected.
- **Derive cases via `work-test`** — use the pairwise tiering workflow to pick the minimal-but-covering set; copy the unit (and integration, if `Level: integration`) rows here.

### Manual test
- Required even when `Autotest` covers the behavior — exists to verify integration / UX the test suite can't see.
- `Steps` is a numbered list of literal commands or actions.
- `Expected` is a numbered list aligned 1:1 with `Steps`.
- `Skip?` defaults to `no`. To skip: `skip — reason: <specific>` (e.g., "pure internal refactor, no observable behavior change").
- **Derive cases via `work-test`** — only keep manual cases a test can't prove (UX feel, log shape, real third-party behaviour).

### Commit
- `Prefix` from the standard set.
- `Subject` is the exact line the implementer will commit. ≤ 72 chars, imperative mood, no trailing period.
- The implementer does not invent the subject.

### Definition of done
- Checklist the implementer ticks off in their head before flipping `plan.md` checkbox.
- Items 1-4 are fixed (Files, Autotest, Manual test, scope discipline). Item 5 is the Commit subject.
- Add extra items only when this TODO has unusual post-conditions (e.g., "DB migration applied on staging").

## Iteration

When updating an existing TODO:
- Edit in place. Keep the same `N` unless the order changes.
- Renumber only if the order changes — and then update the index in `plan.md` to match.
- Bumping a TODO that's already `[x]` → don't. Create a new TODO instead.

## Anti-patterns

- **Vague Outcome** — "improve auth" with no capability stated.
- **Implementation-leaking Outcome** — "Adds `/auth/refresh` handler in `pkg/auth/handler.go`". Outcome must speak in Terms (actors, commands, events), not files or types.
- **Missing Pre-reads** — implementer guesses at conventions and breaks them.
- **`Command: go test ./...`** when only one package is affected — wastes implementer's run loop.
- **Skipped Manual test without reason** — every skip needs a one-line justification.
- **Commit subject = "update files"** — useless; implementer copies it verbatim and the history rots.
- **Embedding decisions in `## Changes` via `/* ... */`** — hidden decisions belong in `plan.md` Design Decisions.
- **Bundling unrelated edits** — split into two TODOs and order them with `Depends on`.
- **New term used without description** — implementer sees `TokenJar` and doesn't know if it's a struct, a service, or a Redis key. Add a `## New terms` row and update `plan.md` Terms.
- **Interface change described in prose** — "rename Refresh to take a struct" instead of a unified-diff block; implementer must guess the exact signature.
- **New interface stubbed with `// ...`** — every field, method, and doc comment must be written out so the implementer copies verbatim.

## Pre-save checklist

Before saving a TODO file, verify:

- [ ] All 12 required sections present and in order
- [ ] Every path in **Files** exists in the repo (or is marked `create`)
- [ ] Every path in **Pre-reads** exists
- [ ] `## Changes` is one TS snippet ≤ 40 lines, side effects + errors visible
- [ ] **Outcome** is a capability statement in use-case language; mentions only Terms (actors, commands, events, aggregates); contains no file paths, type names, routes, or libraries
- [ ] Every domain term used in the TODO is either in `plan.md` Terms or in a `## New terms` section in this TODO (and was added to `plan.md` Terms)
- [ ] Every modified public interface has a unified-diff block in real syntax under `## Changes`
- [ ] Every new public interface is written out in full (all fields, methods, doc comments) under `## Changes`
- [ ] `Autotest.Command` is a single runnable shell command
- [ ] `Manual test` Steps and Expected are aligned 1:1
- [ ] `Commit.Subject` is the literal commit line, ≤ 72 chars, imperative
- [ ] No vague verbs (improve / handle / refactor stuff / clean up)
- [ ] No reference to plan-level Goal or AC-IDs
- [ ] Matching index entry exists in `plan.md`
