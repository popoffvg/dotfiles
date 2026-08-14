# wm plugin

The work-management flow: design a change, implement it, teach it. One user-invocable router
(`/code <subcommand>`, default `new`) over three worker skills.

**`INDEX.md` is the map — what is where.** Every skill, every file, and what each one owns. No
`SKILL.md` restates it; read `INDEX.md` before deciding where something belongs.

Use the `skill-build` skill for changing any skill here.

## The common layer

Three files at this root are shared by all four skills. Nothing else at this level is.

| File | Holds |
|---|---|
| `INDEX.md` | The map: which skill owns which file, and what that file owns. |
| `GLOSSARY.md` | **The leading words** — one word, one meaning, used verbatim by all four skills. A word used in two skills is defined here; a word private to one is defined there. |
| `CLAUDE.md` | This file: how to work on the plugin. |

## Rule: the router holds routing and the shared taxonomy, nothing else

`code` is the only user-invocable skill. It owns the subcommand table, the pipeline, and the two
cross-cutting references (`ref-subcommand-rules.md`, `ref-jj-notes.md`). Every procedure belongs to
the skill that owns the work — `arch` designs, `impl` writes source, `teach` teaches.

A procedure added to `code` that is neither routing nor shared vocabulary is in the wrong skill.
Put it where the work lives and cite it from the table.

## Rule: `SKILL.md` routes; it does not contain the procedure

Each `SKILL.md` holds its operation table and nothing more. To run a subcommand: pick the row in
`code/SKILL.md`, open the file its Reference column names, follow it.

## Rule: every subcommand has a command file

Each subcommand in the `code/SKILL.md` table points to exactly one `sub-<subcommand>.md` (except
`help` = `SKILL.md`). It lives in the skill that owns the operation and is cited with that skill's
prefix. Adding a subcommand = add the table row **and** create its command file in the same change.
A `(self)` or missing reference column is incomplete.

## Rule: cite across skills with the owner's prefix

`arch:`, `impl:`, `teach:`, `code:` name the skill that owns the file; `wm:` names this root. A bare
filename always means a file in the citing skill. Moving a file means updating every citation of it
in the same change — a prefix that points at the wrong skill is a broken link that still reads as
prose.

## Rule: the roster lives in two files

`/code help` and `commands/code-help.md` print the subcommand table verbatim. Any roster change —
adding, removing, renaming a subcommand, or editing a one-line description — lands in both
`code/SKILL.md` and `commands/code-help.md` in the same commit. The repo-wide statement of this rule
is in the root `CLAUDE.md` § Subcommand rosters.
