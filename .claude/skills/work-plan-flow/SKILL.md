---
name: work-plan-flow
description: >
  Describe TODO behavior using TypeScript pseudocode. Use inside the
  **Changes** section of any `_notes/todos/TODO-N.md` to specify
  workflows, state machines, and component shapes precisely without
  prescribing implementation details.
---

# work-plan-flow

TS pseudocode is the canonical way to describe what a TODO must do. It replaces ad-hoc bullets, prose, and the deprecated `step::` / `state::` notations.

## Why TS pseudocode

- LLM-readable — every model already knows TS syntax.
- Type signatures make boundaries explicit (inputs, outputs, errors).
- Control flow (`if`, `switch`, `for`) maps directly to implementation.
- Side effects are visible (`db.set(...)`, `emit(...)`, `assert(...)`).
- Cheap to diff when the plan iterates.

## Rules

1. **Real TS syntax, fake bodies.** Use TypeScript that parses; replace internals with `/* ... */` or short comments when detail is irrelevant.
2. **One snippet per TODO**, ≤ 40 lines. If you need more, split the TODO.
3. **Types are documentation.** Prefer named types over `any`. Use unions for variants, never magic strings.
4. **Side effects explicit.** Show every external call (`redis.set`, `db.tx`, `emit`, `log`, `fs.write`).
5. **Errors as values or thrown explicitly.** No silent failure.
6. **No imports, no real file paths inside the snippet.** Paths live in the TODO's **Files** section.
7. **Comments describe intent, not types.** Bad: `// string id`. Good: `// reject if already activated`.

## Patterns

Pick the pattern that matches the TODO's **Type**.

### Pattern: workflow

Sequential operation. Show inputs → steps → output, with branches and side effects.

```ts
type RefreshRequest = { token: string }
type TokenPair = { access: string; refresh: string }

function refresh(req: RefreshRequest): TokenPair | 401 {
  const session = redis.get(`auth:${req.token}`)
  if (!session || session.expiresAt < now()) return 401

  const pair = mintTokens(session.userId)            // new access + refresh
  redis.del(`auth:${req.token}`)                     // invalidate old
  redis.set(`auth:${pair.refresh}`, session, TTL)    // store rotated

  return pair
}
```

### Pattern: state machine

Discriminated union for states. Pure `transition(state, event)` function with guards + side effects per arm.

```ts
type State = "Pending" | "Active" | "Suspended" | "Completed"
type Event = "activate" | "suspend" | "complete"

function transition(s: State, e: Event): State {
  if (s === "Pending" && e === "activate") {
    assert(allRequiredFieldsPresent())
    setActivatedAt(now())
    return "Active"
  }
  if (s === "Active" && e === "suspend") {
    assert(inFlightJobs() === 0)
    snapshotProgress()
    return "Suspended"
  }
  if (s === "Active" && e === "complete") {
    assert(allItemsProcessed())
    emit("completion")
    return "Completed"
  }
  throw new Error(`invalid transition ${s} + ${e}`)
}
```

### Pattern: component

Interface + class skeleton. Show the contract and the wiring point.

```ts
interface Repository<T> {
  get(id: string): T | null
  set(id: string, value: T): void
  delete(id: string): void
}

class RedisRepository<T> implements Repository<T> {
  constructor(private client: RedisClient, private prefix: string) {}
  get(id: string): T | null { /* read & parse */ return null }
  set(id: string, value: T): void { /* serialize & SET with TTL */ }
  delete(id: string): void { /* DEL */ }
}

// wire-up at cmd/server/main.go
const repo = new RedisRepository<Session>(client, "auth:")
container.register("sessionRepo", repo)
```

### Pattern: event handler / pipeline

Use when work is a queue/stream consumer.

```ts
type Event = { type: "user.created" | "user.deleted"; payload: unknown }

async function onEvent(e: Event): Promise<void> {
  switch (e.type) {
    case "user.created":
      const u = parseUser(e.payload)             // throws on schema mismatch
      await cache.warm(u.id)
      await emit("user.indexed", { id: u.id })
      return
    case "user.deleted":
      await cache.evict((e.payload as { id: string }).id)
      return
  }
}
```

### Pattern: data shape change

For pure schema / type edits (no behavior change). Show before → after.

```ts
// before
type Job = { id: string; status: string; createdAt: number }

// after
type Job = {
  id: string
  status: "queued" | "running" | "done" | "failed"
  createdAt: number
  retries: number   // new — default 0 on existing rows
}
```

## Where this lives

- **In TODO file:** under `## Changes`, fenced as ` ```ts `.
- **Not in plan.md** — `plan.md` only carries the index. Bodies (and pseudocode) live in `_notes/todos/TODO-N.md`.
- **Not in source code** — pseudocode never gets copied into the repo. The implementer translates it.

## Anti-patterns

- Prose paragraphs inside the code block ("here we will then...")
- Unbounded snippets — if it grew past 40 lines, the TODO is too big
- Real imports / real file paths inside the snippet
- `any` everywhere — defeats the point
- Hiding decisions inside `/* ... */` (a hidden algorithm is a hidden decision; lift it to `plan.md` Design Decisions)

## Quick checklist before saving the TODO

- [ ] One TS snippet in `## Changes`
- [ ] Compiles in your head (matched braces, declared names)
- [ ] All side effects visible
- [ ] All error paths visible (return code, throw, or explicit `null`)
- [ ] ≤ 40 lines

## Lint — run before saving any pseudocode block

Use this as a self-check on every pseudocode snippet (TODO `## Changes` or `explore` `<ep-slug>.workflow.ts`). Each rule has a deterministic pass/fail signal — no judgement calls.

### Syntax & shape

| ID | Rule | How to check | Fix |
|----|------|--------------|-----|
| L1 | Snippet is fenced as ` ```ts ` (or is the body of `.workflow.ts`) | Inspect fence / file extension | Re-fence as `ts` |
| L2 | Braces, parens, brackets balanced | Count `{` vs `}`, `(` vs `)`, `[` vs `]` | Close the unbalanced pair |
| L3 | Every identifier in the body is either declared, a parameter, or a recognized external (`db`, `redis`, `emit`, `log`, `fs`, `http`, std globals) | Scan for free identifiers | Declare or rename |
| L4 | ≤ 40 lines (`## Changes`) or ≤ 80 lines (workflow.ts orchestrator + helpers) | `wc -l` of the fenced block | Split the TODO or extract a helper function |

### Content discipline

| ID | Rule | How to check | Fix |
|----|------|--------------|-----|
| L5 | No `import` statements | Grep `^import` | Remove; types live inline |
| L6 | No real file paths inside identifiers, string literals, or template literals | Grep `/` or `\\` inside literal/identifier (excluding URLs and comment anchors) | Move paths to the **Files** section or to `// path:line` anchors |
| L7 | No `any` type | Grep `: any\b` / `as any\b` | Replace with a named type or union |
| L8 | No magic strings for variant discrimination | Grep string-literal returns or `kind === "..."` not backed by a union type | Define a union and use it |
| L9 | No hidden algorithms in `/* ... */` blobs longer than one line | Find `/* ... */` blocks; each must summarise intent, not hide a decision | Lift the decision to `plan.md` Design Decisions; reference it in a `// see Decision: X` comment |

### Behavioural completeness

| ID | Rule | How to check | Fix |
|----|------|--------------|-----|
| L10 | Every external call is visible (`db.*`, `redis.*`, `emit`, `log`, `fs.*`, `http.*`, queue/topic ops) | Read line-by-line; no hidden helpers swallowing IO | Inline the call |
| L11 | Every error path is explicit — `return <error>`, `throw <Err>`, or explicit `null` / sentinel | Each `if`/`else if`/`catch` has a terminal arm | Add the missing return/throw |
| L12 | Every `if`/`switch` is exhaustive — no implicit fall-through that drops the value silently | Each branch ends in return, throw, or assignment to a tracked var | Add a default arm or final `throw new Error("unreachable: ...")` |
| L13 | Async fan-out is visible — `await Promise.all(...)`, `await` on each side effect | Grep `async` functions; ensure every effectful call is awaited or explicitly fire-and-forget with `void` | Add `await` or `void` to make intent explicit |

### Pattern conformance

| ID | Rule | How to check | Fix |
|----|------|--------------|-----|
| L14 | Snippet matches the declared **Type** in the TODO header | `Type: workflow` → top-level function; `Type: state machine` → `transition(state, event)`; `Type: component` → `interface` + class skeleton; `Type: event handler` → async `switch` on event type; `Type: data shape change` → `// before` / `// after` type pair | Either rewrite the snippet to match or change the Type |
| L15 | State machines use a discriminated union for `State`, not `string` | Look at the `State` type | Replace with `type State = "A" \| "B" \| ...` |
| L16 | Data-shape-change snippets contain **both** before and after types | Grep `// before` and `// after` markers | Add the missing half |

### Workflow.ts (explore artifact) extras

These apply only to `<ep-slug>.workflow.ts` produced by `explore`.

| ID | Rule | How to check | Fix |
|----|------|--------------|-----|
| L17 | Exports a `meta` object with `name` + `description` | Grep `export const meta` | Add it |
| L18 | Every meaningful line has a `// path:line` anchor | For each non-trivial statement, comment present | Add anchor after verifying the citation |
| L19 | Every cited `path:line` was opened during exploration | Cross-check against `Read` history / `.md` artifact's File map | Open the file and re-cite, or drop the line |
| L20 | One function per workflow; sub-workflows live in additional functions called from the orchestrator | Count exported functions vs. logical workflows | Refactor to one-function-per-workflow |

### Run order

Apply L1–L4 first (structural). If they fail the snippet isn't worth deeper checks. Then L5–L16. For `.workflow.ts` artifacts, finish with L17–L20.

A snippet passes when every applicable rule is green and any deliberate exception is noted in a one-line comment (`// lint: L9 exempt — algorithm summarised in plan.md Decisions`).
