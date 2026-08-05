---
name: flow-scetch
description: >
  Use it when user ask describe the flow or write pseudocode, or ask to check/fix the naming in an
  existing flow sketch or pseudocode artifact. Also use unprompted, BEFORE asking
  the user to settle a batch of design decisions about a flow they have not yet seen written down
  — sketch the flow first and mark each decision at the line where it bites.
---

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
2. **One `namespace` per unit**, one `flow(...)` entrypoint, ≤ 40 lines. When the flow crosses layers, give each layer its own namespace and keep `flow(...)` top-level — see rule 12.
3. **Named types, no `any`, no magic strings** — use unions.
4. **Every side effect visible** (`redis.*`, `db.*`, `emit`, `log`, `fs.*`).
5. **Every error path explicit** — `return <sentinel>` or `throw`. Each distinct failure cause gets its own arm; don't collapse them. If two causes must look identical to the caller (e.g. unknown-token vs wrong-password, to avoid enumeration or a timing leak), say so in a trailing comment — that sameness is a decision, not an accident.
6. **Every branch terminal** — no silent fall-through.
7. **No imports, no real paths** in the snippet (paths go in the TODO's **Files** section).
8. **Decisions surface as branches + a `// see spec.md → Decisions: <name>` anchor.** If a decision is hidden inside `/* ... */`, lift it out.
9. **Follow the data.** `flow` reads as one value's lifecycle — born from the input, guarded, transformed, returned. Order the body by what happens to that value, not by which helper is convenient to call next.
10. **Open with a `// trace:` one-liner.** The first line of `flow` is a one-sentence trace of the whole path. If it can't be written in one sentence, the flow is too big — split the TODO. The trace must match the TODO's Outcome.
11. **Take every type name from the project's own glossary, and cite the line.** Before naming a type, grep the spec/glossary for the concept and use that word verbatim — then put the citation in the doc comment so the next reader can check it. An invented name (`Flag`) beside an existing glossary entry (`Liability`) forks the ubiquitous language on the artifact that is supposed to define it, and every downstream TODO inherits the fork. If the spec uses a word loosely as a verb but has a precise noun in its glossary, the glossary noun wins. Where no term exists, say so in the comment rather than quietly minting one.
12. **The namespace carries the layer; the function carries the domain action.** Never encode the layer in a function name (`runBackend`, `callApi`, `dbSave`) — a layer word inside a function name is both redundant with the namespace and the thing readers get wrong first. Write `Workflow.runModelBackend(...)`, `Transport.send(...)`, not `runBackend(...)`. Two extra checks before accepting a name that contains a layer or component word: (a) grep the glossary for that word — if it is already defined as something else (`Model backend` = *the model*, not the layer running it), the name asserts a false identity; (b) name the layer each helper actually runs in. A prose comment saying "this part runs in the python script, not the orchestrator" is a namespace waiting to be written.
13. **No acronyms or abbreviations in your own identifiers** — `structure`, not `pdb`; `residueIndex`, not `idx`; `confidenceByResidue`, not `c`. Single-letter parameters and truncations cost the reader a lookup on every line. Keep an acronym **only** where it is external vocabulary quoted verbatim — a CLI flag (`--pdb_file`), a column or field name owned by another system (`pl7.app/structure/pdb`), a foreign symbol you are citing (`parse_pdb`) — and say in a comment that it is quoted, so nobody "fixes" it. Renaming your own type also renames its accessors: an acronym-free type with `resolvePdb()` hanging off it is half a rename.

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

## Sketch before asking

When about to ask the user to settle **two or more design decisions** about a flow that has not yet
been written down, sketch the flow first and put the decisions **in** it. Do not open with the
questions.

A decision is only answerable once the user can see what it changes. Asked cold, each option list
demands that the user reconstruct the pipeline from the question — so the reply is "what did you
mean?" or "describe the flow first", and the round trip is wasted.

1. Write the flow — `flow(...)` entrypoints, real types, the data's lifecycle.
2. Mark every open decision at the line where it bites: `// DECISION: <name> (Q<n>)`.
3. Close with a table mapping each decision to its line and why no default is safe.
4. Invite correction of the flow before answers: a wrong flow makes every answer wrong.
5. Only then ask — and let the user answer against the sketch.

Sketching also surfaces decisions the question list missed: a branch with no defined behaviour is a
decision nobody had named yet. Add it to the list rather than silently defaulting it.

Define each domain term where the flow first uses it. A term the user cannot name is a term they
cannot decide about — see `newcomer-teaching-material` for the same failure in explanatory prose.

One quick question about something already on screen needs no sketch. Two or more, or anything
touching a flow the user has not seen, does.

## Anti-patterns

- Prose inside the code block
- Hidden algorithm in `/* ... */` (lift to `spec.md` Decisions)
- Opening with an option list for a flow the user has not seen written down
