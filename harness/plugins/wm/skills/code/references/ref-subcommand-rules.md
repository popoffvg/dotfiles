# code — shared subcommand rules

The contract every `/code` subcommand obeys.

## Obey RULES.md
Read `<notes-dir>/RULES.md` before the first step. It says what to raise with the human and what
to decide alone; it wins over a subcommand's own default. It never lowers a hard gate — the human
still reads the spec at the `review→impl` gate, destructive git is still confirmed. Missing file →
use the defaults in `tpl-rules.md` § Rules table, and let `new` Step 0.6 write it.

## Archive superseded thoughts
A superseded thought moves to `thoughts/archived/` — never deleted, never left in the live graph.
See `ref-note-format.md` § Superseding.

## Log to notes-dir
After each step, `jj commit` in `<notes-dir>`. See `ref-jj-notes.md`.

## Commits
Messages, one-commit-per-chunk, fixups on correction. See `sub-commit.md`.

## Glossary
New or renamed terms → update `GLOSSARY.md` in the same commit. Table shape: `tpl-glossary.md`.

## Source is read-only
Read-only over project source; write only under `<notes-dir>`. See `ref-write.md`.

## Confirm destructive git
Confirm before any history-rewriting or tree-removing git/wt action.
