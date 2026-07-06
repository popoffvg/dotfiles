# code — todo (TODO bodies)

Authors `todos/TODO-N.md` bodies from a reviewed `spec.md` + `thoughts/`. Owns the TODO element
list, the **verification chain**, and the **outcome** rules. Spec contract + the gate: `ref-write.md`.
Vocabulary: `../GLOSSARY.md`.

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

## Precondition — past the gate

Run `todo` only after a human has reviewed the spec (`ref-write.md` § the gate). `new` stops before
this deliberately. Before authoring: `spec.md` at `Status: review`, Open Questions empty, ledger
settled, and the human has asked for TODOs. Otherwise stop and run `/code new` first.

## Audience — a context-free Sonnet implementer

No project context, no judgment, no permission to improvise. If the implementer must *infer*
anything — a path, a name, a test command, a decision — the TODO is broken. Rewrite it.

## Operating principles

1. **Concrete over abstract.** Real paths, commands, signatures. No "etc.", "as needed".
2. **Strong verbs.** *rename X to Y, add field Z to type T, delete function F* — never *improve, handle, refactor stuff, clean up*.
3. **Every section is a checklist to tick off.** Prose → bullets or a code block.
4. **One TODO = one commit.** Group related edits; >8 files → ask before writing.
5. **Pseudocode is the spec** (load the `flow-scetch` skill). The implementer translates; they do not invent.
6. **No outward links** — reference other TODOs only via `Depends on`.
7. **Pre-reads are mandatory** — every file to understand before editing.
8. **New terms are defined, not assumed** — a domain term missing from `GLOSSARY.md` gets a `## New terms` row (see § New terms below).
9. **Interface changes ship as a git diff** — modifications as a unified diff, new interfaces written out in full (every field, method, doc comment). The implementer copies, not designs.

## File location

`<notes-dir>/todos/TODO-N.md`, `N` 1-indexed and contiguous, one file per ledger row. Restate that
row's outcome verbatim at the top. Resolve `<notes-dir>` from the active phase — never hardcode `.notes/`.

## Required elements — in order

Exact headings, this order. The template ([tpl-todo.md](../references/tpl-todo.md)) is this list as a
fillable skeleton; they stay in lock-step. Order runs the **verification chain** first
(Type → Outcome → Terms → Changes → Autotest), then execution scaffolding — a human reads
top-down and stops after Autotest; the implementer reads on.

| # | Element | Level | Required | Block |
|---|---------|-------|----------|-------|
| 1 | `TODO-N: <title>` | H1 | always | — |
| 2 | `**Type:**` | inline | always | verify |
| 3 | `**Depends on:**` | inline | always | scaffold |
| 4 | `**Risk / blast radius:**` | inline | always | verify |
| 5 | `**Thoughts:**` | inline | always (`none` only if the spec has no thoughts) | verify |
| 6 | `Outcome` | H2 | always | verify |
| 7 | `New terms` | H2 | only if the TODO adds terms missing from GLOSSARY.md | verify |
| 8 | `Changes` | H2 | always | verify |
| 9 | `Autotest` | H2 | always | verify |
| 10 | `Files` | H2 | always | scaffold |
| 11 | `Pre-reads (MUST read before editing)` | H2 | always | scaffold |
| 12 | `Skills to load` | H2 | always | scaffold |
| 13 | `Manual test` | H2 | always | scaffold |
| 14 | `Commit` | H2 | always | scaffold |
| 15 | `Definition of done` | H2 | always | scaffold |

Missing any `always` element → invalid. Worked example: [../examples/ex-TODO.md](../examples/ex-TODO.md) — match its concreteness.

## The verification chain

A correct TODO is self-explanatory: a human approves it by walking five elements, repo closed.

**Type → Outcome → New terms → Changes → Autotest**

| Element | Verifies | Link |
|---------|----------|------|
| Type | what kind of change — frames the rest | — |
| Outcome | is this the right capability? (the anchor) | — |
| New terms | right vocabulary, consistent with GLOSSARY.md? | grounds Outcome |
| Changes | does the behavior deliver the Outcome? | fulfills Outcome |
| Autotest | do the tests prove the Outcome? | verifies Outcome |

Outcome is the anchor; Changes and Autotest are checked *against* it. Consistent chain → correct
TODO. The rest — Files, Pre-reads, Skills, Commit, Manual test, Definition of done — is execution
scaffolding, machine-checkable (paths exist, command runs, subject ≤ 72 chars), no human read.

## Section rules

### Type
One of `workflow | state machine | component | event handler | data shape change`. Determines the `## Changes` pattern — see the `flow-scetch` skill.

### Depends on
`none`, or `TODO-M` (must be `[x]` first), or several (`TODO-2, TODO-3`). No forward references.

### Risk / blast radius
A 1–5 score for **reach** — the surface a regression forces you to retest, not effort. A one-line edit to a shared type is a 5; a large isolated new module is a 1.

| Score | Reach | Retest |
|-------|-------|--------|
| 1 | local, additive — new path, no existing behavior touched | just the new path |
| 2 | one component, isolated edit | that component |
| 3 | modifies behavior others call | component + its callers |
| 4 | shared/utility code, several consumers | every consumer |
| 5 | core contracts many modules depend on | cross-module regression pass |

Format: `**Risk / blast radius:** <1-5> — <tier + what to retest>`. Score ≥ 3 → Autotest/Manual test covers the callers, not just the new code. High score signals keep-it-small, not blocked.

### Thoughts
`[[wikilinks]]` to every `thoughts/NNN-*.md` this TODO implements or is constrained by — the same notes as the spec.md Plan **trace**. Comma-separated, note-number order. Every link resolves to a real file. `none` only when the spec has no thoughts yet.

### Outcome
**Capability, not implementation.** Answers *"what new can the system do once this lands?"* in use-case language.

- Phrasing: `<actor> can <capability> [when <condition>]` or `<aggregate> emits <event> when <command> succeeds`. Present tense, active.
- GLOSSARY.md names verbatim. One or two sentences — more means the TODO is too big, split.
- **Banned:** file paths, function/struct names, routes, package names, libraries, "add a field", "wire up".
- Don't restate the spec Goal — scope to *this* TODO's slice.

Good: *"A `User` can issue `RotateToken`; on success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid."*
Bad: *"Add a `/auth/refresh` handler in `pkg/auth/handler.go`"* (paths/infra) · *"Introduce a `RefreshRequest` struct"* (types, not capability).

Pure refactor with no new capability → say so: *"No new capability; reshapes the `Session` aggregate so future `RotateToken` variants share a path."* Still in Terms, not paths.

### New terms
Any domain term not in GLOSSARY.md gets a row here, immediately after Outcome, **and** is added to GLOSSARY.md the same pass:

```markdown
## New terms

| Term | Kind | Description |
|------|------|-------------|
| TokenJar | entity | Per-user container of active refresh tokens; bounded to 5, LRU-evicted |
```

`Kind` ∈ the GLOSSARY.md set. Description is one sentence with the visible contract (TTL, bounds, error semantics). No new terms → omit the section (never write `## New terms\nnone`).

### Changes
TS pseudocode per the `flow-scetch` skill — one snippet per TODO. Multi-file change → still one snippet describing *behavior*; **Files** maps it to paths.

**Interface sub-block (first, when the surface changes).** Modification → unified git-diff in the file's real language:

````markdown
**Interface change — `pkg/auth/handler.go`:**

```diff
-func Refresh(ctx context.Context, token string) (string, error)
+func Refresh(ctx context.Context, req RefreshRequest) (TokenPair, error)
```
````

New interface → written out in full (every field, method, doc comment), real syntax, one block per file. No `// ...` placeholders. The pseudocode shows *behavior*; the sub-block defines the *shape*. Both required when the surface changes. A decision belongs in spec.md Design Decisions, never buried in a `## Changes` `/* ... */`.

### Autotest
`Level: unit | integration | e2e | none` (`none` only for non-behavioral changes, justified in one line). `Command` is one runnable shell command — never "run the relevant tests". `Cases` are one-sentence input → expected bullets. Derive the minimal-but-covering set via `test` (pairwise tiering).

### Manual test
Required even when Autotest covers the behavior — catches integration / UX the suite can't see. `Steps` (literal commands) and `Expected` aligned 1:1. `Skip?` defaults to `no`; to skip, `skip — reason: <specific>`. Keep only cases a test can't prove (UX feel, log shape, real third-party behavior).

### Commit
`Prefix` from the standard set; `Subject` the exact line the implementer commits (≤ 72 chars, imperative, no period). Full conventions: `sub-commit.md`.

### Definition of done
Checklist the implementer ticks before flipping the ledger: Files, Autotest, Manual test, scope discipline, Commit subject. Add items only for unusual post-conditions (e.g. "migration applied on staging").

## Implementation decisions

Choices the spec didn't make — file naming, package structure, error strategy, data shape — are
**impl-decisions**. Write each to `thoughts/` before the next section. Template + when-to-write:
[`tpl-note-impl-decision.md`](../references/tpl-note-impl-decision.md).

## Iteration

Edit in place, same `N` unless order changes (then renumber and update the ledger). A TODO already `[x]` → don't bump; make a new one.

## Pre-save checklist

- [ ] All `always` elements present and ordered; `New terms` present iff the TODO adds terms
- [ ] **Thoughts** links resolve to real files (`none` only if the spec has none)
- [ ] Every **Files** / **Pre-reads** path exists (or is marked `create`)
- [ ] `## Changes` is one TS snippet ≤ 40 lines, side effects + errors visible; changed interfaces have a diff block, new ones written out in full
- [ ] **Outcome** is a capability in GLOSSARY.md terms — no paths, types, routes, libraries
- [ ] `Autotest.Command` is one runnable command; **Manual test** Steps/Expected aligned 1:1
- [ ] `Commit.Subject` ≤ 72 chars, imperative; no vague verbs anywhere; no spec-Goal/AC references
- [ ] Matching ledger row exists in `spec.md`
