---
name: arch
description: >
  Design the work before any code exists — the spec corpus and the component taxonomy. Owns the
  spec pipeline (new, todo, prototype), the spec contract and its artifacts (spec.md, the ledger,
  thoughts/, todos/, GLOSSARY.md), and the brick roster: the closed set of component types
  (command, service, flow, gateway, server / consumer, policy, scheduler, wiring) with the metric
  and common structure of each. Load it when the `code` skill routes to new, todo, or prototype,
  when typing a component, or when deciding whether a component owns one responsibility or two.
user-invocable: false
---

# arch — design the work

The `code` skill routes here; it holds no design procedure of its own.

> **Map**: `wm:INDEX.md` — which skill owns which file, and what that file owns.
> **Vocabulary**: `wm:GLOSSARY.md` — the leading words all four skills use verbatim.

| Operation | Does | File |
|---|---|---|
| `new` | Spec pipeline: init the corpus (`CLAUDE.md`, `RULES.md`), write `spec.md` → grill until no open question note is left → compile the plan with its wave table → **stop at the gate**. Writes no TODO bodies. | `commands/sub-new.md` |
| `todo` | Author self-contained `todos/TODO-N.md` bodies from a reviewed `spec.md` + `thoughts/`. Runs only past the gate. | `commands/sub-todo.md` |
| `prototype` | Settle an OPEN decision with the smallest visible code diff — read the diff, not a report. | `commands/sub-prototype.md` |

## References

`references/` holds the spec contract (`ref-write.md`), the thought-note format
(`ref-note-format.md`), the **brick** roster (`ref-bricks.md`), and one `tpl-*.md` per corpus
artifact. What each owns is in `wm:INDEX.md`; this skill does not restate it.

Every `tpl-*.md` is the finished artifact filled with real content, carrying `>` lines that state
the rule for the block above them. Copy the file, replace the content, delete the `>` lines.

`ref-bricks.md` adds the metric and the common structure of each brick. Naming and module home for
every piece stay in `CODE_STYLE.md` § Domain module layout.
