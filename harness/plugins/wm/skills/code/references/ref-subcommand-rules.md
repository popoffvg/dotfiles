# code — shared subcommand rules

The contract every `/code` subcommand obeys.

## Obey RULES.md
Read `<notes-dir>/RULES.md` before the first step. It says what to raise with the human and what
to decide alone; it wins over a subcommand's own default. It never lowers a hard gate — the human
still reads the spec at the `review→impl` gate, destructive git is still confirmed. Missing file →
use the defaults in `arch:examples/rules.md` § Per step, and let `new` Step 0.6 write it.

## Put a batch of questions in a file the human edits
**Two or more questions at once go to a file, through the `to-user` skill** — one block per
question, each with the source anchor, the question, and a recommended answer the user can accept
as written. Load `to-user` for the block shape and the extraction rule — it owns the field roster,
and the only thing written here is how each field reads for one kind of batch (§ Glossary, a term).
The grill, the init knobs, a quiz, a glossary change set, a batch of open questions: all of these
are batches. The user answers them in their editor, at their pace, with the file in front of them.

**One question that blocks the current step stays inline** — `AskUserQuestion`, answered now. A
route the agent cannot pick without stopping work (`impl:sub-impl.md` § When a correction contradicts the pair) is the
case this covers. A file the user may not open for an hour is the wrong place for it.

**Every question carries its own context, in either form.** Give what forced the question, what
each option changes in the work, and what breaks if the guess is wrong — in the question text, not
somewhere the user has to go looking. Write it in plain words: the short word over the long one,
one meaning per word, no term the user has not used first. An option is a label of 1–5 words plus a
description that names the cost of picking it, never the mechanism behind it.

**Never ask what a written rule already answers.** Before you write a question, check the pair, the printed rule table, and this skill's commands. When one of them decides it, obey it and name the rule in the report. Example: "Which files outside **Files** may increment 1 edit?" is not a question. `impl:sub-impl.md` step 5.1 already says any file the **Do** needs.

The answer becomes a `decision` note with `source: human` (`arch:ref-note-format.md` § Frontmatter),
so a question the human answered from a thin summary records a choice nobody really made. When the
code can answer it, read the code instead and write `source: auto`.

## Obey the generated rule set
Run `~/.claude/scripts/wm-constraints.py <notes-dir>/thoughts` before writing or judging any code.
It prints one row per settled decision an increment can violate, and each row's text is the
decision note's `description` — the **one** home for that rule: no TODO copies a row, and no
subcommand restates one. A decision that changes is an edit to that note, once. Why a rule exists
is not in the table: run the `trace` skill when a rule has to be argued with rather than obeyed.

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
`<notes-dir>/GLOSSARY.md` grows through the whole flow. Entry shape and the three statuses:
`arch:examples/glossary.md`.

**Glossary first.** A term reaches `GLOSSARY.md` before any artifact uses it — a spec section, a TODO
half, a thought, a grill file, or code. Every writer that meets a domain word the file lacks, or uses
one word for a concept the file names another way, adds or corrects the entry in the same step:
`dive docs` reading the code, `new` and the `grilling` skill interviewing the user, `todo` naming a
component, `impl` writing it, `fix` and `line-comment:act` renaming it, `revise` replacing a design.

**Read before you write.** Every agent that writes a spec section, a TODO half, a thought, or code
reads `GLOSSARY.md` first and uses its terms and **Code** identifiers verbatim — never a Forbidden
name, never a retired one.

**The user approves every new, renamed, or retired term before it lands.** Collect the change set —
new terms, reworded definitions, renames, retirements, and each collision where one word carries two
meanings or two entries carry one concept — and send it through the `to-user` skill (§ Put a batch
of questions in a file the human edits). One block per term:

- **Source** — the `path:line` or spec section the term came from.
- **Original** — the word as the code or the user writes it today, with the other names in use.
- **Overlaps** — the existing entries whose definition covers part of this one, or `none`.
- **Recommended** — the entry as it would land, every field of `arch:examples/glossary.md`.
- **Answer** — pre-filled with the recommendation. The user accepts it, rewords it, or writes
  `drop` to reject the term.

Write the accepted entries in the same commit as the work that raised them. A rejected term does not
come back on the next run. A word already in the file with the same meaning is not a change — do not
re-ask it.

**A rename or a retirement sweeps the old name.** Make the old name a Forbidden alias of the new
entry, or retire the entry, then rename every use: `spec.md`, both halves of every TODO, the live
`thoughts/` notes, and — inside the `impl` skill — the code. Outside `impl` the code is read-only:
the sweep stops at the notes and the remaining code uses become a ledger row.

**Status follows the code.** The `impl` commit that lands an entry's **Code** identifier sets
`Status: existing`. A design that drops or replaces a concept sets `Status: retired` and
`Replaced by`; the entry stays.

**Done when** `${CLAUDE_PLUGIN_ROOT}/bin/glossary-lint.py <notes-dir>` reports no finding the change
added — inside `impl`, with `--code <checkout>`.

## Source is read-only
Every subcommand outside the `impl` skill is read-only over project source and writes only under `<notes-dir>` (`arch:ref-write.md`). The `impl` skill's subcommands — `impl`, `auto`, `fix`, `squash`, `commit` — edit project source without asking: any file the work needs, inside the checkout the `where` key names.

## Confirm destructive git
Confirm before any history-rewriting or tree-removing git/wt action.
