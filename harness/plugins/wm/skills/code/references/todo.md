# spec — todo

Authors `todos/TODO-N.md` bodies from an existing `spec.md` + `thoughts/`.

## Precondition — human review gate

Run `todo` **only after a human has manually reviewed the spec.** `new` deliberately stops
before this step; TODO bodies are never auto-written. Before authoring:

- `spec.md` exists with header **`Status: review`**, **Open Questions is empty**, and the TODO List (outcomes) is settled.
- The human has reviewed Goal, Design Decisions, Terms, and TODO outcomes and asked for TODOs.

If `Status` is `init`, Open Questions is non-empty, or no spec exists, stop and run `/code new` first. Do not
author TODOs from an unreviewed spec — a wrong spec becomes wrong TODOs becomes wrong code.

## Audience

**A dummy Sonnet implementer with no project context, no judgment, and no permission to improvise.**

If the implementer has to *infer* anything — a file path, a function name, a test command, a decision — the TODO is broken. Rewrite it.

## Operating principles

1. **Concrete over abstract.** Real paths, real commands, real signatures. No "etc.", "and similar", "as needed".
2. **No vague verbs.** Ban: *improve, handle, refactor stuff, clean up, make better*. Replace with: *rename X to Y, add field Z to type T, delete function F*.
3. **Every section is a checklist the implementer can tick off.** If a section is prose, convert it to bullets or a code block.
4. **One TODO = one commit.** Group related edits; don't split into micro-commits or bundle unrelated work. >8 files → ask the user before writing the TODO. TODO should contain a short, clear commit message summarizing the work (see #Commit Rules).
5. **Pseudocode is the spec.** Use TS pseudocode per `flow`. The implementer translates; they do not invent.
6. **No outward links.** Don't reference spec-level Goal, AC-IDs, or other TODOs except via the explicit `Depends on` field.
7. **Pre-reads are mandatory.** Every file the implementer must understand before editing goes in `Pre-reads`. Missing pre-reads → wrong assumptions.
8. **New terms are described, not assumed.** If the TODO uses a domain term (entity, command, event, component) that is not already in `spec.md`'s Terms table, the TODO must define it before first use *and* the term must be added to `spec.md`'s Terms table in the same planning pass. The implementer never has to guess what a name means.
9. **Interface changes are shown as a git diff.** Any modification to a public interface — function signature, method set, struct/record fields, enum variants, gRPC/HTTP/CLI surface — appears in the TODO as a unified-diff block (`-` old lines, `+` new lines). New interfaces are written out **in full** (every field, every method, every doc comment) so the implementer copies, not invents.

## File location

`<notes-dir>` is the wm notes directory for the current task (commonly `.notes/`). Resolve it from the active phase context; do not hardcode `.notes/` inside this skill.

- Path: `<notes-dir>/todos/TODO-N.md`, where `N` is 1-indexed and contiguous.
- One file per TODO. Bodies never live in `<notes-dir>/spec.md`.
- Linked from the `<notes-dir>/spec.md` index as `- [ ] **TODO-N** — <title> → [todos/TODO-N.md](todos/TODO-N.md)`.

## Required elements (in order)

Every TODO file MUST contain these elements, in this order, with these exact headings. This list is the contract; [todo-template.md](todo-template.md) is the same list as a fillable skeleton — they stay in lock-step.

Order is the **verification chain first** (Type → Outcome → Terms → Changes → Autotest), then execution scaffolding. A human reads top-down and stops after Autotest; the implementer reads on.

| # | Element | Heading level | Required | Block |
|---|---------|---------------|----------|-------|
| 1 | `TODO-N: <title>` | H1 | always | — |
| 2 | `**Type:**` | inline | always | verify |
| 3 | `**Depends on:**` | inline | always | scaffold |
| 4 | `**Risk / blast radius:**` | inline | always | verify |
| 5 | `Outcome` | H2 | always | verify |
| 6 | `New terms` | H2 | only if the TODO introduces terms missing from `spec.md` Terms (see § New terms) | verify |
| 7 | `Changes` | H2 | always | verify |
| 8 | `Autotest` | H2 | always | verify |
| 9 | `Files` | H2 | always | scaffold |
| 10 | `Pre-reads (MUST read before editing)` | H2 | always | scaffold |
| 11 | `Skills to load` | H2 | always | scaffold |
| 12 | `Manual test` | H2 | always | scaffold |
| 13 | `Commit` | H2 | always | scaffold |
| 14 | `Definition of done` | H2 | always | scaffold |

Missing any `always` element → invalid TODO. Order is fixed; `New terms`, when present, sits between `Outcome` and `Changes`.

## Template

- **Skeleton:** [todo-template.md](todo-template.md) — copy it, fill every `<placeholder>`, delete the `<...>` guidance lines and unused conditional sections.
- **Worked example:** [../examples/TODO-example.md](../examples/TODO-example.md) — a complete, valid TODO file. Match its level of concreteness.

Both paths are relative to this skill's directory. Read the skeleton before authoring; read the example when unsure how concrete a section must be.

## Verification chain

A correct TODO is self-explanatory: a human approves it by reading **five elements in this order**, confirming each link — never opening the repo.

**Type → Outcome → Terms → Changes → Autotest**

| # | Element | Verify | Link |
|---|---------|--------|------|
| 1 | Type | What kind of change — frames the rest | — |
| 2 | Outcome | Is this the right capability? (intent, the anchor) | — |
| 3 | New terms | Right vocabulary, consistent with `spec.md`? | grounds 2 |
| 4 | Changes | Does the behavior deliver the Outcome? | 4 fulfills 2 |
| 5 | Autotest | Do the tests prove the Outcome? | 5 verifies 2 |

Outcome is the anchor; Changes and Autotest are checked *against* it, not on their own. If the chain is consistent, the TODO is correct.

The remaining elements — Files, Pre-reads, Skills to load, Commit, Manual test steps, Definition of done — are execution scaffolding for the implementer, not verification targets. They are machine-checkable (paths exist, command runs, subject ≤ 72 chars) and need no human read.

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
- `TODO-M` — TODO-M must be `[x]` in `spec.md` before starting.
- Multiple deps allowed: `TODO-2, TODO-3`.
- No forward references (TODO-3 cannot depend on TODO-5).

### Risk / blast radius

A 1–5 score for how far a regression in this TODO could reach — the surface that must be retested,
not how hard the change is. Score by **reach**, not effort: a one-line edit to a shared type is a 5;
a large but isolated new module is a 1.

| Score | Reach | Retest surface | Example |
|-------|-------|----------------|---------|
| 1 | Local, additive — new code path, touches no existing behavior | just the new path | a new function in a controller |
| 2 | One component, isolated edit to existing behavior | that component | small change inside one handler |
| 3 | Modifies existing behavior other code already calls | the component **+ its callers** | a local change in a controller (retest the flows through it) |
| 4 | Shared/utility code with several consumers | every consumer of that helper | a change in a `util` package of moderate reach |
| 5 | Core contracts many modules depend on | broad — cross-module regression pass | common/shared types, a widely-used `util` package, a core domain aggregate |

Rules:
- Format: `**Risk / blast radius:** <1-5> — <one line: which tier, and what must be retested>`.
- A `util` package spans 3–5 depending on how widely it's imported — say which.
- Score ≥ 3 means existing behavior changes: the **Autotest**/**Manual test** must cover the callers, not just the new code.
- High score is not a blocker; it is a signal to keep the TODO small and the test surface explicit. If a 5 also has a large diff, consider splitting.

### Outcome

**Capability statement, not an implementation summary.**

Outcome answers *"what new can the system do once this TODO lands?"* in **use-case language**, using only terms already in `spec.md`'s Terms table (or this TODO's `## New terms`).

Rules:
- Use case-style phrasing: `<actor> can <capability> [when <condition>]` or `<aggregate> emits <event> when <command> succeeds`. Present tense, active voice.
- Refer to entities, commands, events, and actors by their Terms-table names — verbatim.
- **No implementation vocabulary.** Banned: file paths, function/struct names, HTTP routes, package names, libraries, "add a field", "create a function", "introduce a struct", "wire up", "in `pkg/...`".
- One or two sentences. If you need more, the TODO is too big — split.
- Do not restate the spec-level Goal. Outcome is scoped to *this* TODO's slice of capability.

**Good** (uses Terms, describes capability):
- "A `User` can issue `RotateToken`; on success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid."
- "An `Admin` can issue `RevokeSession`, after which the `Session` rejects every further `RotateToken` with `AuthRefreshFailed`."

**Bad** (implementation leaks):
- "Add a `/auth/refresh` handler in `pkg/auth/handler.go` that calls Redis to rotate the token." → mentions path, package, infra.
- "Introduce a `RefreshRequest` struct and return `TokenPair`." → talks about types, not capability.
- "Wire up the new endpoint." → vague + implementation-flavoured.

If the TODO is purely structural (e.g., a refactor that adds no capability), state that explicitly: *"No new capability; reshapes the existing `Session` aggregate so future `RotateToken` variants share a common path."* The shape change still has to be expressed in Terms, not file paths.

### New terms

If this TODO introduces any domain term not already in `spec.md`'s Terms table, add a `## New terms` section immediately after **Outcome** with one row per new term:

```markdown
## New terms

| Term | Kind | Description |
|------|------|-------------|
| TokenJar | entity | Per-user container holding active refresh tokens; bounded to 5 entries, LRU-evicted |
| EvictToken | command | Issued by TokenJar when capacity exceeded; emits `TokenEvicted` |
```

Rules:
- Kind ∈ same set as `spec.md` Terms (`entity | value-object | aggregate | component | service | policy | state | command | event`).
- Description is one sentence with the visible contract (TTL, bounds, error semantics) — same bar as `spec.md` Terms.
- Every new term must also be added to `spec.md`'s Terms table in the same planning pass; the TODO copy exists so the implementer doesn't have to context-switch.
- If no new terms: omit the section entirely. Do **not** write `## New terms\nnone`.

### Files
- Every file the implementer will touch. Use repo-relative paths.
- Action per file: `create | modify | delete | rename → <new path>`.
- No globs. No "and related files".

### Pre-reads
- Every file the implementer must read first to avoid wrong assumptions.
- Include reason: `path — why`.
- **Order them by the reading path, not alphabetically.** Code is a graph: lead the implementer in the order they should read it.
  1. The happy-path **test** for the touched behavior, if one exists — it states the contract in a few lines before any source. `path — contract: <input → expected>`.
  2. The **entry point** that handles the relevant request/command — the line work starts from, not the top of the file.
  3. The files along the **data path** the change follows, in flow order.
- Tests, callers, neighboring patterns are common pre-reads. Don't list rate limiters, validators, or logging unless the change touches them — keep the implementer on the flow.
- If `none`, write `none — reason: <specific>` (e.g., "creating a new package, no existing files to align with").

### Skills to load
- Skill names only, no paths. Example: `go-modify`, `impl-commit`, `proto-change`.
- If `none`, write `none`.

### Changes
- TS pseudocode per `flow`.
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
- **Derive cases via `test`** — use the pairwise tiering workflow to pick the minimal-but-covering set; copy the unit (and integration, if `Level: integration`) rows here.

### Manual test
- Required even when `Autotest` covers the behavior — exists to verify integration / UX the test suite can't see.
- `Steps` is a numbered list of literal commands or actions.
- `Expected` is a numbered list aligned 1:1 with `Steps`.
- `Skip?` defaults to `no`. To skip: `skip — reason: <specific>` (e.g., "pure internal refactor, no observable behavior change").
- **Derive cases via `test`** — only keep manual cases a test can't prove (UX feel, log shape, real third-party behaviour).

### Commit
- `Prefix` from the standard set.
- `Subject` is the exact line the implementer will commit. ≤ 72 chars, imperative mood, no trailing period.
- The implementer does not invent the subject.

### Definition of done
- Checklist the implementer ticks off in their head before flipping `spec.md` checkbox.
- Items 1-4 are fixed (Files, Autotest, Manual test, scope discipline). Item 5 is the Commit subject.
- Add extra items only when this TODO has unusual post-conditions (e.g., "DB migration applied on staging").

## Implementation decisions

While writing a TODO body, you make choices the spec didn't decide: file naming, package
structure, error handling strategy, library usage, data shape. Every such choice is an
**implementation decision**. Write it to `<notes-dir>/thoughts/` immediately — before
moving to the next section.

Full template, rules, and when-to-write table: [`note-template-impl-decision.md`](note-template-impl-decision.md).

## Iteration

When updating an existing TODO:
- Edit in place. Keep the same `N` unless the order changes.
- Renumber only if the order changes — and then update the index in `spec.md` to match.
- Bumping a TODO that's already `[x]` → don't. Create a new TODO instead.

## Anti-patterns

- **Vague Outcome** — "improve auth" with no capability stated.
- **Implementation-leaking Outcome** — "Adds `/auth/refresh` handler in `pkg/auth/handler.go`". Outcome must speak in Terms (actors, commands, events), not files or types.
- **Missing Pre-reads** — implementer guesses at conventions and breaks them.
- **`Command: go test ./...`** when only one package is affected — wastes implementer's run loop.
- **Skipped Manual test without reason** — every skip needs a one-line justification.
- **Commit subject = "update files"** — useless; implementer copies it verbatim and the history rots.
- **Embedding decisions in `## Changes` via `/* ... */`** — hidden decisions belong in `spec.md` Design Decisions.
- **Bundling unrelated edits** — split into two TODOs and order them with `Depends on`.
- **New term used without description** — implementer sees `TokenJar` and doesn't know if it's a struct, a service, or a Redis key. Add a `## New terms` row and update `spec.md` Terms.
- **Interface change described in prose** — "rename Refresh to take a struct" instead of a unified-diff block; implementer must guess the exact signature.
- **New interface stubbed with `// ...`** — every field, method, and doc comment must be written out so the implementer copies verbatim.

## Pre-save checklist

Before saving a TODO file, verify:

- [ ] All `always` elements present and in order (§ Required elements); `New terms` present iff the TODO adds terms
- [ ] Every path in **Files** exists in the repo (or is marked `create`)
- [ ] Every path in **Pre-reads** exists
- [ ] `## Changes` is one TS snippet ≤ 40 lines, side effects + errors visible
- [ ] **Outcome** is a capability statement in use-case language; mentions only Terms (actors, commands, events, aggregates); contains no file paths, type names, routes, or libraries
- [ ] Every domain term used in the TODO is either in `spec.md` Terms or in a `## New terms` section in this TODO (and was added to `spec.md` Terms)
- [ ] Every modified public interface has a unified-diff block in real syntax under `## Changes`
- [ ] Every new public interface is written out in full (all fields, methods, doc comments) under `## Changes`
- [ ] `Autotest.Command` is a single runnable shell command
- [ ] `Manual test` Steps and Expected are aligned 1:1
- [ ] `Commit.Subject` is the literal commit line, ≤ 72 chars, imperative
- [ ] No vague verbs (improve / handle / refactor stuff / clean up)
- [ ] No reference to spec-level Goal or AC-IDs
- [ ] Matching index entry exists in `spec.md`

# Commit Rules

- Oneliner description of the commit subject (≤ 72 chars)
- The details description why the change is needed
