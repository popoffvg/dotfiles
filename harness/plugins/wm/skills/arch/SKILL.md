---
name: arch
description: >
  Design the work before any code exists — the spec corpus and the component taxonomy. Owns the
  spec pipeline (new, todo, revise, prototype), the spec contract and its artifacts (spec.md, the ledger,
  thoughts/, the todos/ TODO-N.md + TODO-N.agent.md pair, GLOSSARY.md), and the brick roster: the closed set of component types
  (command, service, flow, gateway, server / consumer, policy, scheduler, wiring) with the metric
  and common structure of each. Load it when the `code` skill routes to new, todo, revise, or prototype,
  when typing a component, or when deciding whether a component owns one responsibility or two.
user-invocable: false
---

# arch — design the work

The `code` skill routes here; it holds no design procedure of its own.

> **Map**: `wm:INDEX.md` — which skill owns which file, and what that file owns.
> **Vocabulary**: `wm:GLOSSARY.md` — the leading words all five skills use verbatim.
> **Style**: `harness-dev:text-style` — the house shape of every artifact this skill writes.

| Operation | Does | File |
|---|---|---|
| `new` | Spec pipeline: init the corpus (`CLAUDE.md`, `RULES.md`), write `spec.md` → grill until no open question note is left → compile the plan with its wave table → **stop at the gate**. Writes no TODO bodies. | `commands/sub-new.md` |
| `todo` | Author the self-contained `todos/TODO-N.md` + `TODO-N.agent.md` pair from a reviewed `spec.md` + `thoughts/`. Runs only past the gate. | `commands/sub-todo.md` |
| `revise` | Settle drift from a delta manifest, patching only stale notes and spec sections; reset `spec.md` to `review`. Notes-only. | `commands/sub-revise.md` |
| `prototype` | Settle an OPEN decision with the smallest visible code diff — read the diff, not a report. | `commands/sub-prototype.md` |

## References and examples

`references/` holds the rules: the spec contract (`ref-write.md`), what cuts across the TODO pair's
sections (`ref-todo-sections.md`), the thought-note format (`ref-note-format.md`), and the **brick**
roster (`ref-bricks.md`).

`examples/` holds one file per corpus artifact — two for a TODO: `examples/todo.md` for the human
half and `examples/todo-agent.md` for the agent half. The rules both halves obey are in no file:
`~/.claude/scripts/wm-constraints.py` prints them from `thoughts/`. What each example owns is in
`wm:INDEX.md`; this skill does not restate it.

Every file in `examples/` is the finished artifact filled with real content, and every piece of it
carries its own rules as a `>` block underneath: what that piece must do, what it must contain, when
it is wrong. Copy the file, replace the content, delete the `>` lines. A rule about one section is
written there and nowhere else.

Every example carries its rules inline, including both halves of the TODO pair — each `>` block
states the rule for the piece above it, and that block is the one place the rule is written.
`references/` holds only what no single piece owns.

`ref-bricks.md` adds the metric and the common structure of each brick. Naming and module home for
every piece stay in the `searchable-names` skill.
