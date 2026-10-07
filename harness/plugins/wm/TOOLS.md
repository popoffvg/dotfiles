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

## Find code

| Need | Invocation | Returns |
|---|---|---|
| Where an identifier is defined and used, in a repo under trace | `pgr-call.sh -C <repo> search_code '{"query":"<identifier or regex>"}'` — optional `path_glob`, `file_type`, `max_files` (default 10), `max_matches_per_file` (default 3) | hits grouped by file, each tagged `definition` or `reference`, `source`, `test` or `low-priority`, plus a `best_next_step` line |
| Every call site of a symbol | `pgr-call.sh -C <repo> search_code '{"query":"\\.<Name>\\(","file_type":"go","max_files":200,"max_matches_per_file":50}'` | the whole list, if the `files:` summary line shows `N total, N shown`. The regex matches every receiver: read each hit's receiver, run a second bare `<Name>` query for method values and wrappers, and list `test` hits as tests |
| A file or a directory | `pgr-call.sh -C <repo> find_files '{"pattern":"<part of name>"}'` · `list_dir '{"path":"<dir>"}'` | paths only |

## Obey the corpus

| Need | Invocation | Returns |
|---|---|---|
| The rules this code must obey | `wm-constraints.py <notes>` | one `D<NNN>` row per live approved decision; `[auto]` marks an unapproved rule. Exit 1 = none |
| The rules scoped to one row | `wm-constraints.py <notes> --todo TODO-2` | the same, minus impl-decisions of other rows |
| A rule with no text | `wm-constraints.py <notes> --check` | exit 3 and the offending notes |

## Match spec names to code

| Need | Invocation | Returns |
|---|---|---|
| Which spec names the Go, Rust, JS, or TS code lacks or spells differently | `wm-spec-code-names.py <notes>` | one row per name the corpus uses, worst first: `variant`, `missing` (with the nearest code name), `scope-differs`, `pending-remove`, `pending-change`, `planned`, `landed`, `match`, `removed`. Exit 1 = a `variant`, `missing`, or `scope-differs` row |
| Whether one TODO's names landed | `wm-spec-code-names.py <notes> --todo 2` | the same rows from the `TODO-2` pair only. Done = only `landed`, `removed`, `match` |
| The rows as data, or more of the corpus | `wm-spec-code-names.py <notes> --json [--all] [--include 'research/*.md']` | the records; `--all` adds `external` (a name the code uses but does not declare) and `word` (one lowercase word). The default corpus is `spec.md`, `GLOSSARY.md`, `todos/`, `thoughts/` |

## Ask why it is this way

| Need | Invocation | Returns |
|---|---|---|
| Why an artifact says what it says | the `trace` skill → `Agent(subagent_type: "wm:tracer", prompt: "<anchor> / <notes-dir> / <question>")` | ≤8 decision rows, oldest first, then `live \| superseded \| unrecorded`. `superseded` routes to `arch:sub-revise.md` |
| What the notes said before the last revision | `bin/notes-revision-diff.sh [TODO-N] [--full] [--log] [-- <path>...]` | the changed artifact paths since the newest `revise…` commit. Exit 2 = no such commit, 3 = no notes jj repo |
| The whole notes history | `jj -R <notes> log` | one entry per change, description and timestamp |
| Which commits touched these code lines | `git-line-history.sh <file> <start> <end>` | the `git log -L` trail, opened as a diff |
| What landed in each repo between two revisions | `collect-range-commits.sh <root> <update.tsv> <out-dir>` | one log file per updated repo. **Writes files** |

## Work in the branch's own checkout

| Need | Invocation | Returns |
|---|---|---|
| Enter the worktree a `where: worktree` spec or TODO asks for | the `worktrunk:wt-switch-create` skill, steps 1–3 — the spec's `branch` for a whole spec, a branch named for the TODO when one TODO overrides | the session re-rooted in the worktree, or its absolute path when `EnterWorktree` is refused |
| Merge that branch back when the TODO is done | `impl:sub-squash.md` — `wt merge` in squash mode | one commit on the target branch; the human runs it, never `impl` |

## Patch an artifact

| Need | Invocation | Returns |
|---|---|---|
| Replace one whole section | `md-replace-section.py <file> "<exact heading line>" [<repl-file> \| --delete]` | `replaced lines <a>-<b>`. Fence-aware; exit 1 unless the heading matches exactly once |
| One exact multi-line edit | `md-replace.py <file> <old-file> <new-file>` | `ok <target>`; fails loudly unless the old text appears exactly once |
| Re-link the notes an edit touched | `wm-backlink-thoughts.py <thoughts> <edge-file>` — lines `<id>\|<section>\|<target-id>\|<annotation>` | appends the bullet under `## <section>` and syncs frontmatter `links:`. Idempotent. The `.sh` twin skips the frontmatter sync |
| Reshape a pre-split TODO | `wm-todo-split-agent.py <todos/TODO-N.md>... [--dry-run]` | the pair, agent half left failing `budget-check` until a human hoists each increment's surface |

## Judge how a diff is built

| Need | Invocation | Returns |
|---|---|---|
| Whether one place the correctness gate suspects is really wrong | `wm:agents/correctness-critic.md` § Steps → one `Agent(subagent_type: "wm:hypothesis-checker")` per hypothesis, all in one message | `CONFIRMED \| REFUTED \| UNSURE` with quoted `file:line` evidence; a CONFIRMED correctness verdict adds the failing input and the edit |
| Whether the changed lines use their language the way it expects | the `review` wave → `Agent(subagent_type: "wm:idiom-critic")` with a `report:` line | `PASS \| FAIL` with seven fixed rows; each finding names the guide § section and the idiomatic rewrite in the pinned version |
| Whether the diff writes again a job the repo or its dependencies already do | the `review` wave → `Agent(subagent_type: "wm:reuse-critic")` with a `report:` line | `PASS \| FAIL` with eight fixed rows; each finding names the existing symbol or package at its `file:line` and the rewrite onto it; every empty search carries its positive control |

## Route a gate verdict

| Need | Invocation | Returns |
|---|---|---|
| Every rule in the rule files, and its scope | `wm-rule-batches.py rules [--notes-dir <notes>] [--todo TODO-N]` | one `<rule id>\t<globs>\t<source>` line per rule. Exit 2 = a rule file with no scope or text above its first H1 |
| The rules gate's batches for one diff | `wm-rule-batches.py plan [--notes-dir <notes>] [--todo TODO-N] --range <worktree\|range> --out <dir> [--batch-size 10] [--max-batches 8]` | `manifest.json` and one brief per batch — rules that cover the same files × those files' hunks — at `batches/b001.md` …; prints one summary line with the batch count |
| Whether every planned (file, rule) pair got a verdict | `wm-rule-batches.py check --out <dir>` | per-rule verdict counts, plus `UNCHECKED` and `UNPLANNED` lines. Exit 1 on either |

## Judge the tests a diff already has

| Need | Invocation | Returns |
|---|---|---|
| Which unit and table tests a diff added can be deleted | the `mutation` skill → one `Agent(subagent_type: "wm:mutation-tester")` per batch, at most two, with a `checkout:` line and no `isolation` | `PASS \| FAIL \| n/a` per batch, plus each test to delete with its verdict and who covers it. A red baseline returns `n/a`, never PASS |
| The verdict of each candidate test, by mutation | `go-test-worth.py --checkout <dir> --mutants <tsv> --unit "<go test cmd>" --candidates <file> [--e2e "<cmd>"] [-j N] [-t SEC] [--e2e-timeout SEC]` — TAB lines `<label>\t<file>:<line>\t<perl-expr>`; candidates one `TestName` or `TestName/row` per line | one `MUTANT` line per mutant (state, killing tests, `e2e=yes\|no`), one `TEST` line per candidate — KEEP, USELESS, E2E-COVERED, REDUNDANT, NO-VERDICT. Exit 1 = a test to delete, 2 = red baseline or bad call |
| Run a batch of mutants and report the survivors | `go-mutation-check.sh [-j N] [-t DURATION] [-n] [-F] <checkout> <mutants-file>` — TAB-separated `<label>\t<file>[:<line>]\t<perl-expr>\t<test-command>` | a `progress:` line on stderr as each mutant ends, then one line per mutant — `killed`, `timeout`, `SURVIVED`, `UNCOVERED`, `NO-OP`, `MISPLACED`, or `invalid` — then the `killed=N …` tally. Edits only sandbox copies, never the checkout. Exit 1 when anything survived, was uncovered, no-opped, or was misplaced; 2 when the unmutated command fails; 3 when a run over the same files is still going |

## Check the corpus

| Need | Invocation | Returns |
|---|---|---|
| The impl ruleset one TODO runs under | `bin/impl-ruleset.py <notes-dir> <TODO-N> [--auto]` | the resolved `approve` and `risk`, the level that set `approve`, then `impl:rulesets/approve-<value>.md` and `impl:rulesets/risk-<color>.md`. Exit 2 = no TODO file or a bad key value |
| Every countable verify check | `bin/spec-lint.py <notes> [--json]` | the Phase 0 findings — budgets, frontmatter, section sets, Components, increments, Autotest, waves, rules, open questions, and the glossary checks GL1–GL6 |
| Whether the glossary holds and the corpus obeys it | `bin/glossary-lint.py <notes> [--code <dir>]... [--undefined] [--json] [--quiet]` | GL1 entry fields, GL2 enforceable Forbidden names, GL3 Forbidden or retired names in use, GL4 Code ownership and Status against the code (needs `--code`), GL5 New terms merged, GL6 dead entries; `--undefined` lists compound identifiers no entry holds. Exit 1 = a finding |
| One artifact's budget | `bin/budget-check.py <file>` | over/under, and where it splits |
| Every artifact's budget | `bin/budget-sweep.sh <notes>` | exit 1 when any is over |
| One concept spelled two ways | `bin/term-variants.py <notes>/todos/*.md <notes>/spec.md` | exit 1 and each variant group |
| Whether the spec may advance | `wm-open-questions.sh <notes>/thoughts [--count\|--files]` | open questions; exit 1 when any is open |
| Where a slow verify spent its time | `wm-verify-profile.py <transcript.jsonl>` | per-phase and per-agent wall clock, turns, tools, tokens |
