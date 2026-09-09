---
name: flow-sketch
description: >
  Write a flow as typed TS pseudocode — the canonical way to describe what a change must do before
  any code exists. Use when the user asks to describe a flow, write pseudocode, or check the naming
  in an existing sketch. Also use unprompted, BEFORE asking the user to settle two or more design
  decisions about a flow they have not yet seen written down: sketch the flow first and mark each
  decision at the line where it bites.
---

# flow-sketch — pseudocode that surfaces decisions

**Purpose: surface corner cases and decisions — not implementation.** A sketch is done when the reader can name every branch, every failure cause, and every open decision without opening the source.

The notation itself — `namespace` as the unit, `flow(...)` as the entry point, ≤ 40 lines, side effects and error paths visible, one sketch per brick — is owned by the `wm:arch` skill (`references/ref-bricks.md`). Names are owned by the `wm:searchable-names` skill. This skill adds what neither carries: how to write the body, and when to sketch instead of asking.

## Sketch before asking

**Two or more open design decisions on a flow the user has not seen written down → sketch first, ask second.** A decision is only answerable once the user can see what it changes; asked cold, each option list makes the user reconstruct the pipeline from the question, and the reply is "what did you mean?".

1. Write the flow — real types, the data's lifecycle, every branch.
2. Mark each open decision at the line where it bites: `// DECISION: <name> (Q<n>)`.
3. Close with a table: decision → line → why no default is safe.
4. Invite correction of the flow before answers. A wrong flow makes every answer wrong.
5. Then ask, and let the user answer against the sketch.

Sketching surfaces decisions the question list missed: **a branch with no defined behaviour is a decision nobody had named yet** — add it to the list rather than defaulting it silently. Define each domain term where the flow first uses it; a term the user cannot name is a term they cannot decide about.

One quick question about something already on screen needs no sketch.

## Writing the body

| Rule | Done when |
| --- | --- |
| **Open with `// trace:`** — one sentence covering the whole path | the trace matches the change's stated Outcome; if it needs two sentences, split the change |
| **Follow the data** — the body reads as one value's lifecycle: born, guarded, transformed, returned | no line is ordered by which helper was convenient to call next |
| **Every failure cause gets its own arm** | no two distinct causes share a `return` unless a trailing comment says the sameness is deliberate (enumeration or timing leak) |
| **Every branch terminal** | no silent fall-through |
| **Decisions surface as branches**, anchored `// see spec.md → Decisions: <name>` | no algorithm hides inside `/* ... */` |
| **Real TS, fake bodies** | it parses; bodies may be `/* ... */`; no imports and no real paths |

## Variants

**Pick the variant from the change shape first, then from the brick.**

| Change `type` | Brick of the `main` component | Variant |
|--------|-------------------------------|---------|
| `state machine` | any | transition function |
| `data shape` | any | before/after types only |
| `behavior` | command · flow · policy · server · consumer | the `flow(...)` body — the default |
| `behavior` | service · gateway · scheduler · wiring | interface + constructor |

The brick also fixes the *ordered parts* of the sketch (what a command shows, what a gateway shows) — `wm:arch` § Common structure in `references/ref-bricks.md`.

Transition function — `flow` maps state + event to state:

```ts
namespace Job {
  type State = "Pending" | "Active" | "Suspended" | "Done"
  type Event = "activate" | "suspend" | "complete"

  function flow(state: State, event: Event): State {
    if (state === "Pending" && event === "activate") { assert(ready()); return "Active" }
    if (state === "Active"  && event === "suspend")  { assert(inFlight() === 0); return "Suspended" }
    if (state === "Active"  && event === "complete") { emit("done"); return "Done" }
    throw new Error(`invalid: ${state} + ${event}`)
  }
}
```

Before/after types — `flow` is omitted:

```ts
namespace Job {
  // before
  type JobBefore = { id: string; status: string }
  // after
  type Job = { id: string; status: "queued" | "running" | "done" | "failed"; retries: number }
}
```

## Anti-patterns

- Prose inside the code block.
- An algorithm hidden in `/* ... */` instead of lifted to the spec's Decisions.
- Opening with an option list for a flow the user has not seen written down.
