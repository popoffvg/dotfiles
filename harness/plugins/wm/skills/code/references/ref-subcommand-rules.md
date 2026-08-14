# code — shared subcommand rules

The contract every `/code` subcommand obeys.

## Obey RULES.md
Read `<notes-dir>/RULES.md` before the first step. It says what to raise with the human and what
to decide alone; it wins over a subcommand's own default. It never lowers a hard gate — the human
still reads the spec at the `review→impl` gate, destructive git is still confirmed. Missing file →
use the defaults in `arch:tpl-rules.md` § Rules table, and let `new` Step 0.6 write it.

## Archive superseded thoughts
A superseded thought moves to `thoughts/archived/` — never deleted, never left in the live graph.
See `arch:ref-note-format.md` § Superseding.

## Log to notes-dir
After each step, `jj commit` in `<notes-dir>`. See `ref-jj-notes.md`.

## Commits
One-commit-per-chunk, fixups on correction: `impl:sub-commit.md`. The message itself — subject plus
the cause / goal / decision body — is the `commit-message` skill; load it before writing one.

## Glossary
New or renamed terms → update `GLOSSARY.md` in the same commit. Table shape: `arch:tpl-glossary.md`.

## Source is read-only
Read-only over project source; write only under `<notes-dir>`. See `arch:ref-write.md`.

## Confirm destructive git
Confirm before any history-rewriting or tree-removing git/wt action.
