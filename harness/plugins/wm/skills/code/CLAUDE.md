# `code` skill

One entry point for spec writing, implementation, and bug fixing. Invoked as `/code <subcommand>` (default `new`).

## Structure

```
code/
├── SKILL.md              # entrypoint — the subcommand router
├── references/
│   ├── <subcommand>.md   # one file per subcommand: the contract it follows
│   └── …                 # supporting refs (note formats, flow patterns, templates)
└── examples/             # worked examples cited by references
```

**`SKILL.md` routes; it does not contain the procedures.** It holds the subcommand table — each row maps a subcommand to its reference file — plus the "how they combine" pipeline and the output-shape rules. To run a subcommand: pick the row, open its `references/<subcommand>.md`, follow it.

## Rule: every subcommand has a reference file

Each subcommand in the SKILL.md table points to exactly one `references/<subcommand>.md` (except `help`, which is `SKILL.md` itself). Adding a subcommand = add the table row **and** create its `references/<name>.md` in the same change. A subcommand whose reference column is `(self)` or missing is incomplete.

| Subcommand | Reference |
|---|---|
| `new` *(default)* | `references/new.md` (+ `note-format.md`, `flow.md`, `todo.md`) |
| `verify` | `references/verify.md` |
| `revise` | `references/revise.md` |
| `prototype` | `references/prototype.md` |
| `code-map` | `references/code-map.md` |
| `diff` (`arch` / `impl`) | `references/diff.md` |
| `impl` | `references/impl.md` |
| `tree` (`new` / `merge`) | `references/tree.md` |
| `squash` | `references/squash.md` |
| `fix` | `references/fix.md` |
| `commit` | `references/commit.md` |
| `help` | `SKILL.md` (self) |

## Help command

`/code help` (and the `code-help` command in `../../commands/`) print the subcommand table verbatim — keep them in sync with the SKILL.md table.

## Pipeline

```
research → new → verify → impl → revise   (iterate)
```

`tree` is the worktree-isolated variant of `impl`; `squash` collapses a `tree` branch's fixups (called by `tree merge`).
