# Constraints — the generated view

> **Nobody writes this file.** It is what `~/.claude/scripts/wm-constraints.py` prints from
> `<notes-dir>/thoughts/`. Shown here so a reader knows what the implementer and the reviewer see.
> Rules for the generator: `arch:sub-todo.md` § Constraints.

```console
$ ~/.claude/scripts/wm-constraints.py .notes/thoughts
| # | Constraint | Origin |
|---|------------|--------|
| D003 | Two refreshes racing on the same expired token: the second one returns 409 and the caller retries with the new token. Redis single-flight locking was rejected — 40 lines for under 0.01% of traffic. | [[003-decision-single-flight]] |
| D005 | SessionStore wraps every Redis error in ErrStoreUnavailable, so the auth handler branches on one error type instead of importing the driver. [TODO-2] | [[005-impl-decision-error-wrapping]] |
| D007 | A request body is a named struct, never a bare string. [auto] | [[007-decision-body-struct]] |

3 rule(s) from .notes/thoughts — every one binds the code; `[auto]` nobody approved, read those first
```

## What each column is

- **`#`** — `D<NNN>`, the id of the note that decided it. Stable and unique for free: no `NNN` is
  ever reused, so no rule is ever renumbered and no reader is ever repointed at a different rule.
- **`Constraint`** — the note's frontmatter `description`, verbatim. Writing a good rule *is*
  writing a good description (`ref-note-format.md` § Frontmatter), and there is no second place to
  keep it in step. The generator collapses its whitespace to a single line, so a folded `>` block
  arrives as one paragraph — and a `[[wikilink]]` in a description arrives as literal `[[...]]`
  text, which is why the link belongs in the note body and the rule stays plain prose.
- **`Origin`** — the note itself. Always resolves, because a note that stopped being live is not in
  the output.

## What generates a row

One row per note in `thoughts/` that is **live** (not under `archived/`), **`status: approved`**,
and of type **`decision`** or **`impl-decision`**. The note format itself — the four types, the
`status` values, where `NNN` comes from, the `[[wikilink]]` form, the `todo:` key, and the
`thoughts-archive.sh` hook that does the archiving — is
[`ref-note-format.md`](../references/ref-note-format.md).

- **A `fact` note generates nothing.** A fact is a truth the code cannot violate; a decision is a
  choice it can. That test used to be a human judgement about a table row — now it is the type you
  gave the note.
- **A superseded decision leaves the rule set by leaving the graph.** Set `status: declined` +
  `superseded_by:`, the `thoughts-archive.sh` hook archives it, and its row is gone on the next run.
  No row to repoint, no dead origin to audit.
- **A rule that changed** is an edit to the note's `description`. One place, once, and the note
  stays `approved` — editing the wording of a decision the human already settled is not a new
  decision. A different *choice* is a supersede, not an edit.
- **`[TODO-N]`** marks an `impl-decision` carrying a `todo:` key. `--todo TODO-N` keeps every
  corpus-wide rule **plus** that row's own `impl-decision`s, and drops only the `impl-decision`s
  scoped to a different TODO.
- **`[auto]`** marks `source: auto`: the code or a research doc forced the choice, nobody approved
  it. A reviewer reads those rows first.
- A rule the tests can check gets a matching case in the `## Autotest` of every TODO it binds.
