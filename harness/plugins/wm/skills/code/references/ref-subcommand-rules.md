# code — shared subcommand rules

The contract every `/code` subcommand obeys.

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
