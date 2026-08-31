# arch — the TODO section rules

**Open the filled artifacts first** — [`examples/todo.md`](../examples/todo.md) (human half) and
[`examples/todo-agent.md`](../examples/todo-agent.md) (agent half). They carry the shape and no
rules, so the two can never drift; every rule below is easier to place once you have seen where it
lands.

One entry per section of the pair, in the order `sub-todo.md` § Required elements gives them. That
file owns the procedure — the fan-out, the budgets, the verification chain, the pre-save checklist;
this one owns what goes inside each heading.

> The first four are `TODO-N.md` frontmatter keys (`status`, `type`, `depends_on`, `risk`); the rest
> are body headings. Which half each heading lives in: `sub-todo.md` § Required elements.

### status
The TODO's lifecycle phase — `todo → impl → verify → done`, `blocked` off the path. Machine + who sets each transition: `ref-write.md` § Status. `todo` authors it at `todo` (or `blocked` if a `depends_on` TODO is not yet `done`); never author a TODO straight to `impl`/`done`.

### type
The **change shape**, one of `behavior | state machine | data shape`. It never names a brick — the brick is the **Type** column of the `## Components` row, and it is the brick of the `main` row that picks the sketch shape for a `type: behavior` TODO. The mapping from both to the `## Changes` **Behavior** snippet lives in the `flow-scetch` skill § Variants.

### depends_on
`[]`, or `[TODO-M]`, or several (`[TODO-2, TODO-3]`) — each must reach `status: done` first. No forward references. This list defines the **waves** in `spec.md` § Plan, so record only real edges (`ref-write.md` § Waves): a file this TODO's **Files** cannot touch until M creates it, a symbol M introduces, or a test that cannot pass before M lands. "Feels later" is not an edge — a false one serializes the spec.

### risk
A 1–5 score for **reach** — the surface a regression forces you to retest, not effort. A one-line edit to a shared type is a 5; a large isolated new module is a 1.

| Score | Reach | Retest |
|-------|-------|--------|
| 1 | local, additive — new path, no existing behavior touched | just the new path |
| 2 | one component, isolated edit | that component |
| 3 | modifies behavior others call | component + its callers |
| 4 | shared/utility code, several consumers | every consumer |
| 5 | core contracts many modules depend on | cross-module regression pass |

Format: `risk: <1-5>` in frontmatter. Score ≥ 3 → Autotest/Manual test covers the callers, not just the new code. High score signals keep-it-small, not blocked.

### Outcome
**Capability, not implementation.** Answers *"what new can the system do once this lands?"* in use-case language.

- Phrasing: `<actor> can <capability> [when <condition>]` or `<aggregate> emits <event> when <command> succeeds`. Present tense, active.
- GLOSSARY.md names verbatim. Two to five sentences: the first is the capability, and the rest give a
  reader without context the trigger, the state change, and the failure. Past five, the TODO is too
  big — split it.
- **Banned:** file paths, function/struct names, routes, package names, libraries, "add a field", "wire up".
- Don't restate the spec Goal — scope to *this* TODO's slice.

Good: *"A `User` can issue `RotateToken`; on success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid."*
Bad: *"Add a `/auth/refresh` handler in `pkg/auth/handler.go`"* (paths/infra) · *"Introduce a `RefreshRequest` struct"* (types, not capability).

Pure refactor with no new capability → say so: *"No new capability; reshapes the `Session` aggregate so future `RotateToken` variants share a path."* Still in Terms, not paths.

### New terms
Any domain term not in GLOSSARY.md gets a row here, immediately after Outcome. The row also reaches
GLOSSARY.md, but the pair's author does not put it there — it is returned and the caller merges it
(`sub-todo.md` § Execution step 3), because one shared table written by a wave of forks loses rows:

```markdown
## New terms

| Term | Kind | Description |
|------|------|-------------|
| TokenJar | entity | Per-user container of active refresh tokens; bounded to 5, LRU-evicted |
```

`Kind` ∈ the GLOSSARY.md set. Description is one sentence with the visible contract (TTL, bounds, error semantics). No new terms → omit the section (never write `## New terms\nnone`).

### Constraints

> The rules live in `<notes-dir>/CONSTRAINTS.md`, one file for the whole corpus. Worked example:
> [`examples/constraints.md`](../examples/constraints.md). The agent half carries the pointer at
> that file and never a rule.

**In `TODO-N.agent.md` — the pointer, and nothing else.** One fixed line, first in the file, above
the increments it bounds:

```markdown
## Constraints

Obey [CONSTRAINTS.md](../CONSTRAINTS.md) — every row.
```

- The line is the same in every TODO. It never lists ids, never quotes a rule, never adds a case.
- The section is **always present**, even when the file is empty today: rules are appended as
  decisions settle, and a TODO that dropped the pointer would be implemented against a stale set.
- A rule *this* TODO's tests can check gets a matching case in the human half's **Autotest** — that
  is the one place a constraint reaches into a single row.

**In `CONSTRAINTS.md` — the rule and its origin.** The caller appends, one row per settled decision
**an increment can violate**, never a fork (`sub-todo.md` § Execution step 3):

```markdown
| # | Constraint | Origin |
|---|------------|--------|
| R1 | A second refresh on the same token returns 409; never two valid pairs | [[003-decision-single-flight]] |
| R2 | Refresh tokens expire 15 minutes after issue | [[002-fact-token-ttl]] |
```

- One sentence per row, imperative or invariant — what the code must do, not what was debated. No
  trade-off prose and no rejected alternatives: those stay in the origin note.
- `#` is `R<n>`, 1-indexed, contiguous, unique in the file, and **append-only**. Renumbering
  silently repoints every reader at a different rule.
- One row per decision. A decision already in the file is not appended again because a second TODO
  also obeys it — that repetition is the whole thing this file removes.
- `Origin` is a live `[[note]]` in `thoughts/`, or a document with its section and read date. A rule
  with no recorded origin is a rule nobody can argue with: write the note first, then append.
- A decision no increment anywhere can violate is not a constraint. It is a fact, and it stays in
  `thoughts/` where the `trace` skill can find it.

### Components

The `package.Class` set this TODO touches, one row each, **main part first**. Every row says what the
TODO does to that symbol (**Touch**) and what the symbol does for the Outcome (**Role**), so a human
reads the create/modify/delete list *instead of* any diff — this table is the whole reach of the
change, stated for a reader who never opens the agent half. It is also the map `## Changes` walks:
every row is named by at least one increment there, and no increment there names a component missing
from this table.

```markdown
## Components

| Component | Touch | Type | Part | Role |
|-----------|-------|------|------|------|
| `pkg/auth.Handler` | modify | server | main | Accepts the rotation request and returns the new pair |
| `pkg/auth.TokenJar` | create | service | supporting | Holds one user's active refresh tokens |
| `pkg/redis.SessionGateway` | modify | gateway | supporting | Stores and deletes the session key |
```

- **Component** — `package.Class` in the project's own notation (`pkg/auth.Handler`, `auth.SessionStore`,
  `blocks/upload/model.UploadState`). A symbol, never a bare file path — paths live in **Files**.
- **Touch** — what this TODO does to the symbol: `create | modify | delete`. It types the symbol, not
  the file: a `create` component may land in a file **Files** marks `modify`, and a `modify` component
  may need a new file. A component this TODO only reads is not touched — it belongs in **Pre-reads**,
  not here. A table whose rows are all `create` is a greenfield slice; one with a `delete` row names
  the replacement row in the same table or the TODO that already shipped it.
- **Type** — the **brick**: one of `command | service | flow | gateway | server | consumer | policy |
  scheduler | wiring`. The roster, with the metric and the common structure of each, is the `arch` skill.
  A component that fits no brick, or fits two, owns more than one responsibility — split it before
  writing the body.
- **Part** — `main` or `supporting`. **Exactly one row is `main`**: the component that carries the
  Outcome's behavior. Two candidates for `main` → the TODO does two things, split it.
- **Role** — one sentence, this TODO's slice of the component's job. Not the component's full purpose.
- Every row maps to at least one path in the agent half's **Files**, and every non-test path there belongs to a row — except a file changed only as a consequence of another row's decision (§ A diff carries the change, not what the change forces).

### Surface

> Lives in `TODO-N.md`, the human half. The one diff in the pair.

**The whole contract change this TODO makes, written once.** One bullet naming a file, then one
```diff for that file, deepest-first — the same order the increments apply. Every file with a surface
appears; a file that has none carries a plain-fenced contract block instead (below).

**Surface** means what a caller of the changed code can see: types, fields, method and function
signatures, and settings — config keys, flags, defaults — with their real values. New surface is
all-`+` in real syntax, and no field or signature is ever elided.

**Why the human half.** This is the artifact a reviewer approves before any code exists: Components
says *which* symbols move, Surface says *what they become*. Approving one without the other approves
a rename. It is also why the human half's budget is 550 lines rather than a hundred — the diff needs
the room.

**No comments, and no `AGENT:` markers.** A decision that seems to want a comment belongs in a
`thoughts/` note and, restated, in the agent half's `## Constraints`. The implementer writes whatever
comments `CODE_STYLE.md` asks for; a comment predicted here is one they would rewrite.

**A file whose whole content is a body has no surface.** A check script, a migration, a test file, a
generated query: it carries a plain fenced block — invocation, arguments, exit codes, output — not a
```diff. There is no before/after to show, only a contract.

**Sizing.** ≤ 150 changed lines per file. Over that, first check for a body (§ A diff carries the
surface, not a body) — deleting one usually takes the file under on its own. If every line is real
surface and the file still cannot compile below the budget, keep it and add a `**Compile floor:**`
bullet under that diff saying why. The whole section is bounded by the 550-line human budget, and a
Surface that fills it is a ledger row holding two deliverables.

#### A diff carries the change, not what the change forces

**One entry per file whose contract this TODO decides.** A file that only *moves* to a contract
decided elsewhere in the same section carries no entry: a caller that passes the new argument, an
import updated after a symbol moves, a middle layer that only forwards a new field, a name replaced
at every use. Its diff is already fixed by the entry it follows, so writing it puts one decision in
two places — the same reason a body never appears here.

**The test: does the reader make a choice in this file?** Read the entry this one depends on, then ask
what this file can look like. One answer → it is a consequence; skip it. More than one answer → it is
a real decision; keep it. A caller that must *build* the new argument — pick a default, convert a
value, read a config key — decides what to pass, and that value is what the human approves. Keep the
deciding line alone, never the propagation around it.

**A skipped consequence still has a home, and it is the agent half.** The file stays in `## Files`;
the increment that changes the deciding symbol says to migrate the call sites in its **Do**, and its
**Blast radius** names them. § Changes already demands that instruction, which is why Surface can drop
the diff and lose nothing. A consequence-only file gets no `## Components` row either — it holds no
symbol this TODO decides.

#### A diff carries the surface, not a body

A **body** is anything whose content *is* the implementation: a function or method body, a loop, a
branch chain, a shell script, a SQL query, a regex, a fixture, a table of literal expected values, a
test file's assertions. None of it goes in a `## Surface` diff, and the reason is not length — it is
that a body written here is written twice. The implementer either copies it, in which case the review
happened against a paste; or improves it, in which case the TODO is wrong from the first commit.

**The default is absolute: never put a function body in the diff.** Not to show intent, not because
the body is short, not because it "clarifies" the signature. Show the signature; put the logic in the
increment's **Behavior** sketch, where it is pseudocode nobody can copy.

**The one exception is a human asking for it directly.** When the human explicitly says they want a
body written out for a specific symbol, write it — and mark it, so the next reader can tell an
approved body from a smuggled one:

```
- **Body requested:** `Refresh` — the human asked for the full body on 2026-08-21.
```

That marker sits under the file's diff in `## Surface`. It is the only thing that makes a body legal,
it names the symbol it covers, and it covers nothing else. Absent the marker, a body is a finding —
`verify` reports it and the `budget-check` hook cannot see it, which is why the marker is explicit
rather than inferred. Never add the marker on your own judgment: the human asks, or there is no body.

**The test: could the implementer type this from the sketch?** If yes, the sketch is enough and the
body is noise. `stat -f%z` vs `stat -c%s`, `set -euo pipefail`, the exact `jq` filter, the real
`$REPO` paths, the literal byte counts — every one of those is a choice the implementer makes while
looking at the actual repo, and none is a choice a human approves at the gate.

**A command someone runs is not a body.** The rule is about code that ships in the repo, so it never
reaches a literal invocation: the Autotest **Command**, a **Manual test** step, the arguments in a
contract block. Those are required to be literal — `make run-dev`, `go test ./pkg/auth/...`, the exact
`curl` — because a human or CI types them verbatim and an approximation is useless. The line is
whether the text becomes a file in the repo or gets typed at a prompt.

**When the whole deliverable is a body** — a check script, a migration, a test file, a generated
query — the file has no surface at all. `## Surface` carries its contract as a plain fenced block (how
it is invoked, what it takes, what it exits with, what it prints), and the increment that builds it
carries `Surface: none` plus a **Behavior** sketch naming the checks in order and, above all, **the
edge cases**: the state that must not be reached, the second run that must not refetch, the env var
that must be unset, the count that must match. The edge cases are the part a human can only get from
this file; the mechanics are the part they can only get from the repo.

Worked example of exactly this shape: `examples/todo.md` § Surface (the `scripts/release-check.sh` block)
and `examples/todo-agent.md` § increment 4.

### Changes

> Lives in `TODO-N.agent.md`, and only there. **It carries no diff** — not one ```diff block, not a
> pasted signature. The diff is `TODO-N.md` § Surface, written once.

**An ordered sequence of increments — what to do, in apply order.** One TODO is still one deliverable
and one commit; `## Changes` splits only its *execution*, so the implementer lands a small, verifiable
piece at a time and the human approves each real diff as it appears.

**Increment** = the smallest step worth approving on its own. `### <n>. <imperative title> — `<package.Class>``,
`n` 1-indexed and contiguous. Each increment names exactly one row from `TODO-N.md` `## Components`; a
component may span several increments.

Each increment carries these bullets, in order:

| Bullet | Required | Content |
|--------|----------|---------|
| **Files** | always | the repo-relative paths this increment alone touches — a subset of `## Files` |
| **Surface** | always | which part of `TODO-N.md` § Surface this increment lands, named by symbol — or `none` when it adds no surface (a body-only file, a wiring change) |
| **Do** | always | one to four imperative sentences: the work, in words. What to write, what to migrate, what to delete. **No code, no fenced block, no pasted signature** |
| **Blast radius** | always | the **predicted** reach: the symbols, callers, and consumers a mistake here forces you to retest. Name them; `"low"` is not a blast radius |
| **Behavior** | only where **Do** cannot carry the logic — a real branch structure, an error path that matters, a non-obvious ordering | TS pseudocode per the `flow-scetch` skill, ≤ 40 lines, side effects + error paths visible |
| **Builds** | only when the increment leaves the repo not compiling | `builds: only with increment <n>` |

**Do is prose, and that is the point.** The signature is in § Surface; what an increment adds is the
*instruction* — which call sites to migrate, what order to touch things in, what to delete. A **Do**
that pastes the signature back has put one fact in two files. A **Do** that says "implement the
handler" has said nothing: name the work.

**Every signature change names its call sites in some increment's Do.** A widened signature whose
callers appear in no **Do** is a caller that will be left broken, and § Surface cannot catch it —
Surface shows the new shape, not who has to move to it.

**Ordering — deepest first.** Order increments so the repo builds after each one: the callee before
its caller, the type before its user, the wiring last (same rule as **layer (Ln)**). An increment
that cannot leave the repo compiling says `builds: only with increment <n>`, and that is a last
resort — prefer an order where every step builds.

**Sizing.** > 10 increments → the TODO is too big, split the ledger row. An increment whose **Do** is
one sentence is fine; small is the point. Counted by the `budget-check` hook (`sub-todo.md` § Budget), along with a
hard rejection of any ```diff block in this file.

> On save the `format-todo` PostToolUse hook (`bin/format-todo.sh`) runs prettier over each ```ts block; unparseable pseudocode is left verbatim. Don't hand-align the block — write it, the hook formats it.

````markdown
### 2. Return a pair from the minter — `pkg/auth.TokenMinter`

- **Files:** `pkg/auth/token.go`
- **Surface:** `mintTokens`
- **Do:** Widen `mintTokens` to the § Surface signature. Mint the refresh token alongside the access token and return both; propagate either signing error unchanged. Migrate both call sites to the new return.
- **Blast radius:** every caller of `mintTokens` — `pkg/auth/handler.go`, `pkg/auth/login.go`
````

**How the increments reach the commit** (executed by `impl:sub-impl.md`, stated here so the human knows
what an approval buys): increment 1 creates the commit; each later approved increment is appended to
that same commit (`git commit --amend --no-edit`), except an increment that corrects work the human
rejected — that one lands as a fixup (`impl:sub-commit.md` § Fixups). The final message is
`TODO-N.md` `## Commit`. A rejected increment stops the TODO — nothing after it is applied.

### Autotest

> Lives in `TODO-N.md`, the human half — it is a link in the verification chain, not scaffolding. What
> the change *proves* is a design question the reviewer answers at the gate: a capability nobody can
> assert is a capability nobody agreed to. The **Target files** and the **Command** are here for the
> same reason the cases are — they say which suite carries the proof, not how to write it.

**Two levels, both required: `Unit` and `E2E`.** One TODO ships the behavior *and* the proof at both
scales — that is what makes it self-contained. Neither level is optional by default.

| Level | Proves | Scope |
|-------|--------|-------|
| `Unit` | the changed unit behaves, in isolation | the new/edited function, type, or component; no network, no DB, no process boundary |
| `E2E` | the **Outcome** holds through the real entry point | the request/command enters where a user or caller enters it and the observable result is asserted |

Each level carries, on its own bullets:
- **Target files** — the test file path (`create` if new).
- **Entry point** — `E2E` only: where the request or command enters, named as a caller enters it
  (`POST /auth/refresh` on the running server), so each case asserts the Outcome as an observer sees
  it rather than as the implementation sees it.
- **Cases** — one-sentence `input → expected` bullets; each traces to the Outcome or to a `CONSTRAINTS.md` row this TODO can violate. Derive the minimal-but-covering set via `test` (pairwise tiering).
- **Command** — one runnable shell command. Never "run the relevant tests".

**Cases, never the test.** This section is the only place a test appears in the pair, and it appears
as sentences. No assertion source, no fixture, no table of literal expected values, no shell — a test
file's body is a body, and § A diff carries the surface, not a body applies to it in full. A test
worth writing out here is a test the implementer would have written from the case; a test that
*cannot* be written from the case means the case is too vague, and the fix is a sharper sentence, not
a paste. When the test file itself is the deliverable, it is an increment with an **Interface** and a
**Behavior** sketch in the agent half — never source in this table.

A level that genuinely cannot exist is written `none — <one-line concrete reason>`; the reason names
what makes it impossible, not that it feels redundant. Auto-reject: "covered by the unit test",
"trivial", "no e2e harness" (name the missing harness and add a TODO for it instead). A pure refactor
with no behavior change may set `E2E: none — no observable behavior changes; unit suite pins the
reshaped API`, but only when the Outcome itself claims no new capability.

For a TODO whose Outcome is not observable end-to-end alone, the `E2E` level names the wave-mate or
later TODO whose e2e test covers it: `none — observable only via TODO-3; its E2E case asserts this
path`. That is the one shape where an e2e gap is legal, and three things bind it:

- **The named TODO must exist in the ledger**, and its `## Autotest` `E2E` must carry a **case that
  asserts this path**. A deferral to a TODO whose E2E never mentions it is not a deferral — it is an
  untested path with a citation.
- **Deferring to a Manual test does not count.** `Manual test` catches what no suite can see; it is
  not the automated cover this level is claiming.
- **The shape is rare, because most of its old users are no longer rows.** An enabler with one
  consumer is increment 1 of that consumer (`ref-write.md` § Merges that fall out of this rule), so
  it has no `E2E` of its own to defer. What is left is the genuinely separate row: another repo, or
  an interface with two or more consumers.

### Commit

**The message of the one commit `## Changes` builds, written here in full and copied — never
re-derived at commit time.** Two fields, both human-read: `Title` and `Body`.

- **Title** — the exact line the implementer commits: `<prefix>: <line>`, ≤ 72 chars, imperative, no
  period. Prefix from the standard set. The ledger entry's `Commit` is this line.
- **Body** — cause, goal, and the decision if a live alternative was rejected, one paragraph each in
  that order. Cause and goal expand the ledger entry's `Why`; the decision comes from the notes
  `## Constraints` cites. Full contract: the `commit-message` skill.

**Write the body for a reader who has only the repo.** No `TODO-N`, no note id, no ticket — the
increments above are gone once the commit lands, and this text is all that stays. A body that could
only be written by someone holding the TODO is the wrong body.

**Check it against the Outcome before any increment is applied.** Same change, stated twice for two
audiences: the Outcome in the actor's terms, the title in the repo's. A capability in one and not the
other means the TODO is wrong — fix it at `todo`, not at commit time. When to commit and what a user
correction lands as: `impl:sub-commit.md`.

### Deviations

**Not yours to write.** `todo` never creates this section; the pair leaves the gate with sections
2–7 and nothing after them. `impl` appends it when the user corrects a shown diff into something a
section above forbids, and only when the correction stays inside this TODO — the fork and its blast
radius test: `impl:sub-impl.md` § When a correction contradicts the pair. `revise` folds every row
into the section it names and deletes the whole block.

Read it as a reader of the pair: the approved text above still says what the human approved, and
this table says where the shipped code went elsewhere and which note holds the reason. One row per
correction, four columns:

- **What** — the section and the symbol, id, or case the correction contradicts: `## Surface: Refresh`,
  `## Autotest Unit: case 3`, `## Outcome`.
- **Shipped instead** — the shape or behavior that actually landed, one line.
- **Why** — the reason the approved version lost, one line.
- **Note** — the `[[NNN-impl-decision-slug]]` holding the full reasoning.

A correction that reaches past this TODO — another TODO's symbol, a ledger row, a settled `decision`
note — is not a deviation: it routes to `revise`.

Worked example: [`examples/todo.md`](../examples/todo.md) § Deviations.

### Manual test
Required even when Autotest covers the behavior — catches integration / UX the suite can't see. `Steps` (literal commands) and `Expected` aligned 1:1. `Skip?` defaults to `no`; to skip, `skip — reason: <specific>`. Keep only cases a test can't prove (UX feel, log shape, real third-party behavior).

### Definition of done
Checklist the implementer ticks before advancing `status` to `verify` and filling the ledger's Commit: Files, Autotest, Manual test, scope discipline, Commit title. Add items only for unusual post-conditions (e.g. "migration applied on staging"). It sits in the agent half, so its Files row points at a section in the same file and its constraints row points at `CONSTRAINTS.md`; the one row it cannot restate is the Commit message, which it cites in the human half by name.
