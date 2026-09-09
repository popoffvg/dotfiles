---
name: trace
user-invocable: false
description: >
  Answer "why is it this way?" about anything a spec corpus produced — an Outcome, a Components
  split, a Surface shape, a constraint row, an Autotest level set to none, a line of shipped code.
  Spawns one subagent that searches `<notes-dir>/thoughts/` and returns a short decision trace.
  Load it whenever a decision behind a TODO, a spec, or a diff has to be defended, changed, or
  superseded — `impl:sub-fix.md` Step 1, `arch:sub-revise.md`, a reviewer arguing with an approved
  shape, or the user asking "why did we do X".
---

# trace — where a decision came from

The TODO pair states **what** to build. The thought graph in `<notes-dir>/thoughts/` states **why**,
one note per recorded decision or fact. This skill is the edge from the first to the second, walked
on demand instead of stored: no file in `todos/` carries an origin link, so nothing can go stale.

**Always search in a subagent, never inline.** The graph outgrows the point where reading it is
affordable, and the notes that answer one question are the wrong context for the work that asked it.
The subagent reads the notes; you get back the answer alone.

## Run it

Spawn **one** `wm:tracer` agent per question. Give it three things and nothing else:

| Give it | Example |
|---------|---------|
| The **anchor** — the artifact you want defended, quoted | `Surface: RefreshRequest takes a named struct, not a string` |
| The **notes dir** | `.notes` (resolve from the active phase — never hardcode) |
| The **question** — defend, supersede, or explain | `The reviewer wants a bare string back. What settled this, and is it still live?` |

```
Agent(subagent_type: "wm:tracer", prompt: "<anchor> / <notes-dir> / <question>")
```

Two anchors that bear on each other are two agents, in one message, run at once.

## What comes back

A trace of **at most 8 rows**, newest decision last, plus one verdict line:

```
[[001-decision-rotate-on-refresh]] — rotation beat a shorter TTL — this row is the observable slice
[[003-decision-single-flight]]     — a second refresh returns 409 — depends on 001
verdict: live. No archived note in the chain.
```

`verdict: superseded` names the replacement note. `verdict: unrecorded` means the graph never held
this decision — the choice was made in code with no note behind it, which is itself the finding.

## Act on it

| Verdict | Next |
|---------|------|
| `live` | The decision stands. Argue with the note, not the artifact — a change here is `arch:sub-revise.md`, not an edit to the TODO. |
| `superseded` | The corpus drifted. Run `arch:sub-revise.md`; archiving the note already took its rule out of the generated set, so there is nothing to repoint. |
| `unrecorded` | Write the note first (`arch:examples/note-impl-decision.md`), then decide. |
