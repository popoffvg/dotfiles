---
name: trace
user-invocable: false
description: >
  Answer "why is it this way?" about anything a spec corpus produced — an Outcome, a Components
  split, a Surface shape, a constraint row, an Autotest level set to none, a line of shipped code.
  Spawns one subagent that searches the ADRs in `<notes-dir>/adr/` and returns a short decision trace.
  Load it whenever a decision behind a TODO, a spec, or a diff has to be defended, changed, or
  superseded — `impl:sub-fix.md` Step 1, `arch:sub-revise.md`, or the user asking "why did we do X".
---

# trace — where a decision came from

The TODO pair states **what** to build. The ADRs in `<notes-dir>/adr/` state **why**, one ADR per
recorded decision. This skill is the edge from the first to the second, walked
on demand instead of stored: no file in `todos/` carries an origin link, so nothing can go stale.

**Always search in a subagent, never inline.** The ADRs outgrow the point where reading them is
affordable, and the ADRs that answer one question are the wrong context for the work that asked it.
The subagent reads the ADRs; you get back the answer alone. It starts at `wm-adr-index.py`, then
walks the markdown links between ADRs and the changelogs, with their `Superseded by` lines.

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
[ADR-0001](0001-sessions-survive-token-theft.md) — rotation beat a shorter TTL — this row is the observable slice
[ADR-0003](0003-refresh-is-single-flight.md)     — a second refresh returns 409 — links to ADR-0001
verdict: live. No archived ADR in the chain.
```

`verdict: superseded` names the replacement ADR. `verdict: unrecorded` means no ADR holds this
decision — the choice was made in code with no ADR behind it, which is itself the finding.

## Act on it

| Verdict | Next |
|---------|------|
| `live` | The decision stands. Argue with the ADR, not the artifact — a change here is `arch:sub-revise.md`, not an edit to the TODO. |
| `superseded` | The corpus drifted. Run `arch:sub-revise.md`; archiving the ADR already took its rules out of the generated set, so there is nothing to repoint. |
| `unrecorded` | Record it as an ADR with the `adr` skill first (`arch:ref-adr-format.md`), then decide. |
