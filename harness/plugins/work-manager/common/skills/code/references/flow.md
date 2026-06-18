# spec — flow

TS pseudocode is the canonical way to describe what a TODO must do.

**Purpose: surface corner cases and decisions — not implementation.**

## Shape

- Wrap the component in a `namespace` named after it (the unit being changed).
- Every flow's entrypoint is `function flow(...)`. Sub-steps are helper functions in the same namespace.
- Types declare boundaries; bodies show branches, guards, side effects.

```ts
namespace Auth {
  type RefreshReq = { token: string }
  type Pair = { access: string; refresh: string }

  // trace: look up the session by token, reject if unknown/expired/rotating, mint a new pair and rotate.
  function flow(req: RefreshReq): Pair | 401 | 409 {
    const s = redis.get(`auth:${req.token}`)
    if (!s) return 401                          // unknown token
    if (s.expiresAt < now()) return 401         // expired
    if (s.rotating) return 409                  // decision: reject concurrent refresh
                                                // see spec.md → Decisions: "single-flight refresh"
    const pair = mint(s.userId)
    redis.del(`auth:${req.token}`)              // invalidate old before storing new
    redis.set(`auth:${pair.refresh}`, s, TTL)
    return pair
  }

  function mint(userId: string): Pair { /* ... */ return { access: "", refresh: "" } }
}
```

## Rules

1. **Real TS, fake bodies.** Must parse; bodies may be `/* ... */`.
2. **One `namespace` per TODO**, one `flow(...)` entrypoint, ≤ 40 lines.
3. **Named types, no `any`, no magic strings** — use unions.
4. **Every side effect visible** (`redis.*`, `db.*`, `emit`, `log`, `fs.*`).
5. **Every error path explicit** — `return <sentinel>` or `throw`. Each distinct failure cause gets its own arm; don't collapse them. If two causes must look identical to the caller (e.g. unknown-token vs wrong-password, to avoid enumeration or a timing leak), say so in a trailing comment — that sameness is a decision, not an accident.
6. **Every branch terminal** — no silent fall-through.
7. **No imports, no real paths** in the snippet (paths go in the TODO's **Files** section).
8. **Decisions surface as branches + a `// see spec.md → Decisions: <name>` anchor.** If a decision is hidden inside `/* ... */`, lift it out.
9. **Follow the data.** `flow` reads as one value's lifecycle — born from the input, guarded, transformed, returned. Order the body by what happens to that value, not by which helper is convenient to call next.
10. **Open with a `// trace:` one-liner.** The first line of `flow` is a one-sentence trace of the whole path. If it can't be written in one sentence, the flow is too big — split the TODO. The trace must match the TODO's Outcome.

## Variants

State machine — `flow` is the transition function:

```ts
namespace Job {
  type State = "Pending" | "Active" | "Suspended" | "Done"
  type Event = "activate" | "suspend" | "complete"

  function flow(s: State, e: Event): State {
    if (s === "Pending" && e === "activate") { assert(ready()); return "Active" }
    if (s === "Active"  && e === "suspend")  { assert(inFlight() === 0); return "Suspended" }
    if (s === "Active"  && e === "complete") { emit("done"); return "Done" }
    throw new Error(`invalid: ${s} + ${e}`)
  }
}
```

Component (interface + wiring) — `flow` is the constructor / wire-up:

```ts
namespace SessionRepo {
  interface Repo<T> { get(id: string): T | null; set(id: string, v: T): void }

  function flow(client: RedisClient): Repo<Session> {
    return {
      get: (id) => { /* GET, parse, null on miss */ return null },
      set: (id, v) => { /* SET with TTL */ },
    }
  }
}
```

Data shape change — `flow` is omitted; show before/after types only:

```ts
namespace Job {
  // before
  type _Job = { id: string; status: string }
  // after
  type Job = { id: string; status: "queued" | "running" | "done" | "failed"; retries: number }
}
```

## Checklist

- [ ] `namespace <Component> { ... }` wrapper
- [ ] One `flow(...)` entrypoint (or a before/after pair for data-shape)
- [ ] Opens with a `// trace:` one-sentence line that matches the TODO's Outcome
- [ ] Body is ordered by the data's lifecycle, not by call convenience
- [ ] Every corner case is a visible branch with a terminal arm; failure arms that intentionally look identical say so
- [ ] Every non-obvious decision has a `// see spec.md → Decisions: <name>` anchor
- [ ] No `any`, no imports, no real file paths, no magic strings
- [ ] ≤ 40 lines — split the TODO if larger

## Anti-patterns

- Prose inside the code block
- Hidden algorithm in `/* ... */` (lift to `spec.md` Decisions)
- Multiple top-level functions instead of one `flow` + helpers
- `any` or untyped string variants
