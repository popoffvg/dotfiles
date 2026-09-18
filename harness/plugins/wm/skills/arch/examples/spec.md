---
status: init                   # init → review → impl. Phase machine: ref-write.md § Status
approve: increment             # increment | todo | none — what the human approves during impl. ref-write.md § Approval
where: in-place                # in-place | worktree — the checkout impl writes into. ref-write.md § Where the work happens
branch: feat/auth-refresh      # the branch this spec belongs to; set once at init. ref-write.md § Spec ownership by branch
drives: A stolen refresh token stops working the moment the real client refreshes.   # one sentence — what this work delivers, user-facing
---

# Spec

> A filled `<notes-dir>/spec.md`. Copy the file, replace the content, delete the `>` lines — each one
> states the rules for the section above it. The contract around the file — status machine, the gate,
> TODO ordering and waves, the readiness checklist — is `arch:ref-write.md`.
> Budget: ≤ 200 lines. Over budget → move detail to `thoughts/` or split the spec, never shrink the ledger.
> The prose follows `harness-dev:text-style`, and — because a human reads this file to make a
> decision — the `i-have-adhd` rules for that human half.

## Description

The components, the token's lifecycle, and the refresh flow are drawn in `@CONCEPTS.md`.

`/auth/refresh` hands back a new access token and keeps the same refresh token alive forever, so a
leaked refresh token is a permanent account key. Nothing in the store can tell a replay from a
legitimate call. This spec rotates the refresh token on every exchange and revokes the session when
a spent one comes back, behind the existing `auth.v2` flag.

> 2–5 sentences. Name the entry point the request actually enters (`/auth/refresh`, the handler, the
> subscriber) — not the top of a file.
> **Draw nothing here.** App architecture, data flow, and the flow this work changes are diagrams,
> and they live in the sibling `@CONCEPTS.md`, drawn with the `show-me` skill (example:
> `examples/concepts.md`). Mention the file, and write the Description as the prose a reader lands on
> after looking at it.
> Terms live in the sibling `@GLOSSARY.md`, patterns in the sibling `@PATTERNS.md` — mentioned here,
> restated never.

## Goal

A stolen refresh token stops working the moment the real client refreshes: every exchange mints a
new pair and invalidates the previous token, and a replayed token revokes the whole session instead
of minting a pair. Everything stays behind the `auth.v2` flag, so the old path is one config change
away.

> Plain language, 2–5 sentences, no IDs and no TODO references.
> It must contain the **one-sentence trace** — entry to exit in one line. A flow you cannot state in
> one sentence is a flow you have not understood (`ref-write.md` § Reading chain).

## What we're NOT doing

- SDK auto-retry on a 401 — the app still routes to the login screen until the `auth.v2` clients ship; separate spec.
- Refresh-token binding to device or IP — needs a device registry that does not exist.
- Rate limiting on `/auth/refresh` — the gateway limiter already covers `/auth/*`; walked past deliberately.

> Say what you walked past, so a gap reads as intentional rather than missed (`ref-write.md`
> § Reading chain, step 4).
> Decisions live in `thoughts/` as `NNN-decision-*.md`, open questions as `NNN-question-*.md` — never
> as sections here. A choice made while writing this spec that has no note yet is an unrecorded
> thought: write the note, then continue.

## TODO List (the ledger)

#### TODO-1
**Layer:** L0 — leaf

**Outcome:** A replayed refresh token leaves the `Session` revoked and mints no `TokenPair`.

**Concretely:**

| Today | After |
|---|---|
| `Store.Rotate` overwrites the stored token and returns the new pair, so the same token works twice. | The swap fires only while the presented token is still the current one; a spent one revokes the session instead. |

**Done when:** the replay test gets a revoked session and no new pair.

**Commit:** `auth: revoke the session on a replayed refresh token`

**Why:** A refresh token that survives its own use is a permanent account key — a single leaked token grants access forever, and nothing in the store can tell a replay from a legitimate call.

#### TODO-2
**Layer:** L1 — calls the store

**Outcome:** `RotateToken` returns a new `TokenPair` and emits `TokenRotated`.

**Concretely:**

| Today | After |
|---|---|
| The handler re-signs the access token and hands back the same refresh token. | The handler mints a fresh pair through the store's conditional swap and emits `TokenRotated`. |

**Done when:** `/auth/refresh` returns a refresh token different from the one it was called with.

**Commit:** `auth: rotate the refresh token on every exchange`

**Why:** Rotation is what makes the replay check reachable — without a new token per exchange, the store's conditional swap never fires and TODO-1 protects nothing.

> Index only — outcomes, not bodies. Each row is a discussion object the user aligns on before any
> body is drafted; the bodies in `todos/TODO-N.md` restate the outcome verbatim.
>
> **Layer** — the `Ln` depth: `L0` is a leaf, `Ln` calls something below it (`ref-write.md`
> § TODO ordering and waves).
>
> **Outcome** — a post-condition (what is true after), ≤ 25 words, `GLOSSARY.md` terms verbatim, no
> implementation nouns. Full rules: `arch:examples/todo.md` § Outcome. A row hiding an "and" splits; two
> rows sharing an outcome merge.
>
> **`Concretely` is the plain-language twin of `Outcome`, and it is not optional.** `Outcome` is
> abstract and glossary-bound, which is what makes it checkable and what makes it unreadable to
> anyone who does not already hold the design. `Concretely` is written for comprehension: a two-column
> **Today | After** table, then one **Done when** line.
>
> |  | **Today** | **After** |
> |---|---|---|
> | Holds | the current behaviour, one or two sentences | the same behaviour once the row lands, in a verb a non-author would use (*moves, deletes, teaches, throws away, puts the choice in the user's hands*) |
> | Wrong when | it could be written without opening the repo | it says *improves, handles, wires up* |
>
> **Done when** goes on its own line below the table: the observable check. It is wrong when nobody
> can run it. A pure refactor's is often *"output is byte-identical before and after"* — a real
> check, and the strongest one such a row can have.
>
> One row in the table. Two rows means two TODOs. The columns compare the *same* behaviour, so a
> reader sees the change by reading across. Module and symbol names are **allowed here** and banned
> in `Outcome` only — they are what makes "today" concrete.
>
> **Commit** — a ≤ 72-char imperative subject. **Why** — the commit body: the problem or constraint
> that forced this commit, and what breaks without it.

## Plan

Rotation lands in the store first, where the conditional swap and the revoke both live and can be
tested with no HTTP. The handler then mints through it and emits `TokenRotated`, which is the point
the endpoint's contract changes. The `auth.v2` flag stays the on/off switch throughout — no row
removes the old path.

### Waves — parallel execution

| Wave | TODOs | Runs together because |
|------|-------|-----------------------|
| W1 | TODO-1 | `depends_on: []` |
| W2 | TODO-2 | `depends_on: [TODO-1]` — mints through the conditional swap |

> The Plan is the target picture in 3–5 sentences, one per major branch of the work.
> Widest wave first — how the waves are computed, and why `Ln` is not the execution order:
> `ref-write.md` § TODO ordering and waves.
>
> **spec.md ends after the Plan.** Four rules govern the prose of every section above — a symbol
> named in words at first use, an ordered list instead of rationale prose, a parameter table when the
> work adds a knob, a diagram when the change is structural: `ref-write.md` § Write it for a reader
> who does not hold your context.
