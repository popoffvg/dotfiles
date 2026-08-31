---
name: arch
description: >
  Design the work before any code exists — the spec corpus and the component taxonomy. Owns the
  spec pipeline (new, todo, prototype), the spec contract and its artifacts (spec.md, the ledger,
  thoughts/, the todos/ TODO-N.md + TODO-N.agent.md pair, CONSTRAINTS.md, GLOSSARY.md), and the brick roster: the closed set of component types
  (command, service, flow, gateway, server / consumer, policy, scheduler, wiring) with the metric
  and common structure of each. Load it when the `code` skill routes to new, todo, or prototype,
  when typing a component, or when deciding whether a component owns one responsibility or two.
user-invocable: false
---

# arch — design the work

The `code` skill routes here; it holds no design procedure of its own.

> **Map**: `wm:INDEX.md` — which skill owns which file, and what that file owns.
> **Vocabulary**: `wm:GLOSSARY.md` — the leading words all five skills use verbatim.

| Operation | Does | File |
|---|---|---|
| `new` | Spec pipeline: init the corpus (`CLAUDE.md`, `RULES.md`, `CONSTRAINTS.md`), write `spec.md` → grill until no open question note is left → compile the plan with its wave table → **stop at the gate**. Writes no TODO bodies. | `commands/sub-new.md` |
| `todo` | Author the self-contained `todos/TODO-N.md` + `TODO-N.agent.md` pair from a reviewed `spec.md` + `thoughts/`, appending every settled decision it finds to `CONSTRAINTS.md`. Runs only past the gate. | `commands/sub-todo.md` |
| `prototype` | Settle an OPEN decision with the smallest visible code diff — read the diff, not a report. | `commands/sub-prototype.md` |

## References and examples

`references/` holds the rules: the spec contract (`ref-write.md`), the TODO section rules
(`ref-todo-sections.md`), the thought-note format (`ref-note-format.md`), and the **brick** roster
(`ref-bricks.md`).

`examples/` holds one file per corpus artifact — two for a TODO: `examples/todo.md` for the human
half and `examples/todo-agent.md` for the agent half. The rules both halves obey are one corpus
file, `examples/constraints.md`. What each owns is in `wm:INDEX.md`; this skill does not restate
it.

Every file in `examples/` is the finished artifact filled with real content. Copy the file, replace
the content, delete the `>` lines.

Where the rules live differs by artifact, and each example says so in its own header. A note example
(`examples/note-*.md`) and a corpus file (`examples/rules.md`, `examples/constraints.md`,
`examples/glossary.md`, …) carries its rules inline — each `>` line states the rule for the block
above it. The two TODO examples carry only the artifact: their rules live in `commands/sub-todo.md`,
which is the one place a rule about a TODO section is written.

`ref-bricks.md` adds the metric and the common structure of each brick. Naming and module home for
every piece stay in `CODE_STYLE.md` § Domain module layout.
