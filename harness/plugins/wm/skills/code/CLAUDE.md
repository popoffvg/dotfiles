# `code` skill

One entry point for spec writing, implementation, and bug fixing. Invoked as `/code <subcommand>` (default `new`).

Use /skill-write for changing.

## Structure

```
code/
├── SKILL.md              # entrypoint — the subcommand router
├── GLOSSARY.md           # the skill's leading words (the gate, thought, outcome, ledger, layer…)
├── commands/             # sub-<subcommand>.md — one file per subcommand: the contract it follows
├── references/           # shared refs (ref-write, ref-note-format, ref-subcommand-rules) + templates (tpl-*)
└── examples/             # worked examples (ex-*) cited by commands/refs
```

**`SKILL.md` routes; it does not contain the procedures.** It holds the subcommand table (each row → its command file) plus the pipeline. To run a subcommand: pick the row, open its `commands/sub-<subcommand>.md`, follow it.

## Single source of truth

`references/ref-write.md` owns the spec contract — artifacts, notes-dir layout, the `Status` header, **the gate**, TODO ordering, the Spec-Readiness Checklist. Other refs point to it instead of restating. Other owners: `commands/sub-new.md` (grill loop + exit contract), `commands/sub-todo.md` (TODO elements + verification chain + outcome rules), `ref-note-format.md` (thought notes), the `flow-scetch` skill (TS pseudocode `## Changes`), `commands/sub-commit.md` (commits), `ref-jj-notes.md` (history), `commands/sub-code-map.md` (D2/ELK/HTML rendering), `ref-subcommand-rules.md` (the rules every subcommand obeys: logging, commits, glossary currency, source read-only, confirm destructive git). `GLOSSARY.md` holds the leading words every ref uses verbatim — distinct from the *notes-dir* glossary (project ubiquitous language, template `references/tpl-glossary.md`).

## Rule: every subcommand has a command file

Each subcommand in the SKILL.md table points to exactly one `commands/sub-<subcommand>.md` (except `help` = `SKILL.md`). Adding a subcommand = add the table row **and** create its `commands/sub-<name>.md` in the same change. A `(self)` or missing reference column is incomplete.

## Help command

`/code help` (and the `code-help` command in `../../commands/`) print the subcommand table verbatim — keep both in sync with the SKILL.md table.
