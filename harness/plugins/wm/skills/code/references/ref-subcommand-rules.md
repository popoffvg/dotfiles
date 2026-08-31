# code — shared subcommand rules

The contract every `/code` subcommand obeys.

## Obey RULES.md
Read `<notes-dir>/RULES.md` before the first step. It says what to raise with the human and what
to decide alone; it wins over a subcommand's own default. It never lowers a hard gate — the human
still reads the spec at the `review→impl` gate, destructive git is still confirmed. Missing file →
use the defaults in `arch:examples/rules.md` § Rules table, and let `new` Step 0.6 write it.

## Ask a question the human can answer without opening a file
**Every question carries its own context.** Give what forced the question, what each option changes
in the work, and what breaks if the guess is wrong — in the question text, not in a file the user
has to open. Write it in plain words: the short word over the long one, one meaning per word, no
term the user has not used first. An option is a label of 1–5 words plus a description that names
the cost of picking it, never the mechanism behind it.

The answer becomes a `decision` note with `source: human` (`arch:ref-note-format.md` § Frontmatter),
so a question the human answered from a thin summary records a choice nobody really made. When the
code can answer it, read the code instead and write `source: auto`.

## Obey CONSTRAINTS.md
Read `<notes-dir>/CONSTRAINTS.md` before writing or judging any code. It is short — one row per
settled decision an increment can violate — and it is the **one** home for those rules: no TODO
copies a row, and no subcommand restates one. A decision that changes is edited there, once. Why a
rule exists is not in the file: run the `trace` skill when a rule has to be argued with rather than
obeyed.

## Archive a thought that stops being live
A question once answered, a thought once superseded: it moves to `thoughts/archived/` — never
deleted, never left in the live graph. **Mark it and the `thoughts-archive.sh` hook moves the file;
never `mv` it yourself.** The mark is `status: approved` + `superseded_by:` on an answered question
(`arch:ref-note-format.md` § Resolution) and `status: declined` + `superseded_by:` on a superseded
thought (§ Superseding). The hook reports the live notes still linking to it — repoint them.

## Log to notes-dir
After each step, `jj commit` in `<notes-dir>`. See `ref-jj-notes.md`.

## Commits
One-commit-per-chunk, fixups on correction: `impl:sub-commit.md`. The message itself — subject plus
the cause / goal / decision body — is the `commit-message` skill; load it before writing one.

## Glossary
New or renamed terms → update `GLOSSARY.md` in the same commit. Table shape: `arch:examples/glossary.md`.

## Source is read-only
Read-only over project source; write only under `<notes-dir>`. See `arch:ref-write.md`.

## Confirm destructive git
Confirm before any history-rewriting or tree-removing git/wt action.
