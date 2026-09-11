# Tools — which one answers which need

Every script, agent, and skill the five wm skills reach for, by the need it serves. `INDEX.md` maps
files to owners; this file maps a situation to the thing that resolves it.

**Search the graph before reading it** — run the index, read the descriptions, open only the notes
that bear on the task (`arch:ref-note-format.md` § Finding the thought for your task).

`bin/` means `${CLAUDE_PLUGIN_ROOT}/bin/`. Everything else is `~/.claude/scripts/`.

## Find a thought

| Need | Invocation | Returns |
|---|---|---|
| Which notes mention these terms | `wm-thought-index.py <notes>/thoughts -m 'token\|scope'` | one row per note: id, type, status, tags, title, description, path. Exit 1 = no match |
| Every note of a type | `wm-thought-index.py <notes>/thoughts -t decision --files` | paths only, for a batch read |
| The impl-decisions of one row | `wm-thought-index.py <notes>/thoughts --todo TODO-2` | the notes whose frontmatter `todo:` is that row |
| Whether a note was superseded | `wm-thought-index.py <notes>/thoughts -m '<term>' --archived` | the same rows from `thoughts/archived/` |
| Which notes break the description rule | `wm-thought-index.py <notes>/thoughts --missing-description` | the notes an author must fix |

## Obey the corpus

| Need | Invocation | Returns |
|---|---|---|
| The rules this code must obey | `wm-constraints.py <notes>` | one `D<NNN>` row per live approved decision; `[auto]` marks an unapproved rule. Exit 1 = none |
| The rules scoped to one row | `wm-constraints.py <notes> --todo TODO-2` | the same, minus impl-decisions of other rows |
| A rule with no text | `wm-constraints.py <notes> --check` | exit 3 and the offending notes |

## Ask why it is this way

| Need | Invocation | Returns |
|---|---|---|
| Why an artifact says what it says | the `trace` skill → `Agent(subagent_type: "wm:tracer", prompt: "<anchor> / <notes-dir> / <question>")` | ≤8 decision rows, oldest first, then `live \| superseded \| unrecorded`. `superseded` routes to `arch:sub-revise.md` |
| What the notes said before the last revision | `bin/notes-revision-diff.sh [TODO-N] [--full] [--log] [-- <path>...]` | the changed artifact paths since the newest `revise…` commit. Exit 2 = no such commit, 3 = no notes jj repo |
| The whole notes history | `jj -R <notes> log` | one entry per change, description and timestamp |
| Which commits touched these code lines | `git-line-history.sh <file> <start> <end>` | the `git log -L` trail, opened as a diff |
| What landed in each repo between two revisions | `collect-range-commits.sh <root> <update.tsv> <out-dir>` | one log file per updated repo. **Writes files** |

## Patch an artifact

| Need | Invocation | Returns |
|---|---|---|
| Replace one whole section | `md-replace-section.py <file> "<exact heading line>" [<repl-file> \| --delete]` | `replaced lines <a>-<b>`. Fence-aware; exit 1 unless the heading matches exactly once |
| One exact multi-line edit | `md-replace.py <file> <old-file> <new-file>` | `ok <target>`; fails loudly unless the old text appears exactly once |
| Re-link the notes an edit touched | `wm-backlink-thoughts.py <thoughts> <edge-file>` — lines `<id>\|<section>\|<target-id>\|<annotation>` | appends the bullet under `## <section>` and syncs frontmatter `links:`. Idempotent. The `.sh` twin skips the frontmatter sync |
| Reshape a pre-split TODO | `wm-todo-split-agent.py <todos/TODO-N.md>... [--dry-run]` | the pair, agent half left failing `budget-check` until a human hoists each increment's surface |

## Check the corpus

| Need | Invocation | Returns |
|---|---|---|
| Every countable verify check | `bin/spec-lint.py <notes> [--json]` | the Phase 0 findings — budgets, frontmatter, section sets, Components, increments, Autotest, waves, rules, open questions |
| One artifact's budget | `bin/budget-check.py <file>` | over/under, and where it splits |
| Every artifact's budget | `bin/budget-sweep.sh <notes>` | exit 1 when any is over |
| One concept spelled two ways | `bin/term-variants.py <notes>/todos/*.md <notes>/spec.md` | exit 1 and each variant group |
| Whether the spec may advance | `wm-open-questions.sh <notes>/thoughts [--count\|--files]` | open questions; exit 1 when any is open |
| Where a slow verify spent its time | `wm-verify-profile.py <transcript.jsonl>` | per-phase and per-agent wall clock, turns, tools, tokens |
