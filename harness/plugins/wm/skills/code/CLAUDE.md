# `code` skill

One entry point for spec writing, implementation, and bug fixing. Invoked as `/code <subcommand>` (default `new`).

Use the `skill-build` skill for changing.

**`SKILL.md` routes; it does not contain the procedures.** It holds the subcommand table (each row → its command file) plus the pipeline. To run a subcommand: pick the row, open its `commands/sub-<subcommand>.md`, follow it.

## Single source of truth

`references/ref-write.md` owns the spec contract — artifacts, notes-dir layout, the **status** metadata (spec phase + TODO lifecycle, both in YAML frontmatter), **the gate**, TODO ordering, the Spec-Readiness Checklist. Other refs point to it instead of restating. Other owners: `commands/sub-new.md` (grill loop + exit contract), `commands/sub-todo.md` (TODO elements + verification chain + outcome rules), `ref-note-format.md` (thought notes), the `flow-scetch` skill (TS pseudocode `## Changes`), `commands/sub-commit.md` (commits), `ref-jj-notes.md` (history), `commands/sub-code-map.md` (architecture-map HTML rendering via `/dive explain`), `ref-subcommand-rules.md` (the rules every subcommand obeys: logging, commits, glossary currency, source read-only, confirm destructive git). `GLOSSARY.md` holds the leading words every ref uses verbatim — distinct from the *notes-dir* glossary (project ubiquitous language, template `references/tpl-glossary.md`).

## Rule: every subcommand has a command file

Each subcommand in the SKILL.md table points to exactly one `commands/sub-<subcommand>.md` (except `help` = `SKILL.md`). Adding a subcommand = add the table row **and** create its `commands/sub-<name>.md` in the same change. A `(self)` or missing reference column is incomplete.

## Help command

`/code help` (and the `code-help` command in `../../commands/`) print the subcommand table verbatim — keep both in sync with the SKILL.md table.
