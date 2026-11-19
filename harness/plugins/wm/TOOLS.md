# Tools — which one answers which need

**Search the ADRs before reading them** — run the index, read the decision paragraphs, open only the
ADRs that bear on the task (`arch:ref-adr-format.md`).

`bin/` means `${CLAUDE_PLUGIN_ROOT}/bin/`. Everything else is `~/.claude/scripts/`.

## Find an ADR

| Need | Invocation | Returns |
|---|---|---|
| Which ADRs mention these terms | `wm-adr-index.py <notes>/adr -m 'token\|scope'` | one line per live ADR: number, kind, title, path. `-m` also reads the decision paragraph and the Properties. Exit 1 = no match |
| Every ADR of a kind | `wm-adr-index.py <notes>/adr -k architecture --files` | paths only, for a batch read. `--archived` adds the dropped ADRs |
| Whether an ADR was superseded or deprecated | `wm-adr-index.py <notes>/adr -m '<term>' --archived` | the same rows, plus `adr/archived/` |

## Find code

| Need | Invocation | Returns |
|---|---|---|
| Where an identifier is defined and used, in a repo under trace | `pgr-call.sh -C <repo> search_code '{"query":"<identifier or regex>"}'` — optional `path_glob`, `file_type`, `max_files` (default 10), `max_matches_per_file` (default 3) | hits grouped by file, each tagged `definition` or `reference`, `source`, `test` or `low-priority`, plus a `best_next_step` line |
| Every call site of a symbol | `pgr-call.sh -C <repo> search_code '{"query":"\\.<Name>\\(","file_type":"go","max_files":200,"max_matches_per_file":50}'` | the whole list, if the `files:` summary line shows `N total, N shown`. The regex matches every receiver: read each hit's receiver, run a second bare `<Name>` query for method values and wrappers, and list `test` hits as tests |
| A file or a directory | `pgr-call.sh -C <repo> find_files '{"pattern":"<part of name>"}'` · `list_dir '{"path":"<dir>"}'` | paths only |

## Obey the corpus

| Need | Invocation | Returns |
|---|---|---|
| Create the workflow entry files | `python3 bin/wm-agents.py <project> <notes>` | project, notes, and TODO `AGENTS.md` files; existing instructions remain intact |
| The rules this code must obey | `wm-constraints.py <notes>/adr [-m REGEX] [--json]` | one `ADR-NNNN/Pn` row per Property of a live ADR; `[auto]` marks a rule no operator was asked about. Exit 1 = none |
| An ADR that breaks the format | `wm-constraints.py <notes>/adr --check` | exit 3 and one line per problem: a `status` key, a `## Question` section, an unknown kind, no Property, more than 6 Properties, a `todo:` key; a Property with no `[keep]`/`[new]` mark, a `[keep]` after a `[new]`, over 25 words, evidence words, an empty `If broken`, or a `Recovers by` outside `retry`, `restart`, `a human`, `itself`; no gate file in `adr/gates/`, a Property with no gate row, an empty gate cell, a Theorem with no `∀`/`∃` and `→`, a Verdict other than `Pass`, a gate row with no Property |
| Whether each Property says what its theorem says | {light} `adr-property-checker` agent, `adrs:` the ADR paths only | PASS or FAIL, one finding per `ADR-NNNN/Pn` and slug: a dropped condition, a wider scope, an internal observable, an undefined symbol, a circular assumption, a counterexample that misses, a named mechanism |

## Match spec names to code

| Need | Invocation | Returns |
|---|---|---|
| Which spec names the Go, Rust, JS, or TS code lacks or spells differently | `wm-spec-code-names.py <notes>` | one row per name the corpus uses, worst first: `variant`, `missing` (with the nearest code name), `scope-differs`, `pending-remove`, `pending-change`, `planned`, `landed`, `match`, `removed`. Exit 1 = a `variant`, `missing`, or `scope-differs` row |
| Whether one TODO's names landed | `wm-spec-code-names.py <notes> --todo 2` | the same rows from the `TODO-2` pair only. Done = only `landed`, `removed`, `match` |
| The rows as data, or more of the corpus | `wm-spec-code-names.py <notes> --json [--all] [--include 'research/*.md']` | the records; `--all` adds `external` (a name the code uses but does not declare) and `word` (one lowercase word). The default corpus is `spec.md`, `GLOSSARY.md`, `todos/`, `adr/` (archived ADRs excluded) |

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
| Create the worktree a `where: worktree` spec or TODO asks for | `git -C <checkout> worktree add -b <TODO branch> <task folder>/todo-N <spec branch>` — one tree per TODO, in the task folder that holds `.notes` (`arch:ref-write.md` § Where the work happens) | `<checkout>/.reviewrules/` copied into the new tree when it exists; the session re-rooted in the worktree, or its absolute path when `EnterWorktree` is refused; the tree added to `"folders"` in the task folder's `*.code-workspace` |
| Merge that branch back when the TODO is done | `impl:sub-squash.md` — `git rebase --autosquash`, then `wt merge --no-squash` | one commit per `### Commit` section on the spec's branch and the TODO's tree removed; the human runs it, never `impl` |

## Patch an artifact

| Need | Invocation | Returns |
|---|---|---|
| Replace one whole section | `md-replace-section.py <file> "<exact heading line>" [<repl-file> \| --delete]` | `replaced lines <a>-<b>`. Fence-aware; exit 1 unless the heading matches exactly once |
| Validate moved-file content inside a guard | `python3 bin/file_edit.py` with hook JSON on stdin | proposed file text; reads the source only after a content guard selects the destination |
| One exact multi-line edit | `md-replace.py <file> <old-file> <new-file>` | `ok <target>`; fails loudly unless the old text appears exactly once |
| Reshape a pre-split TODO | `wm-todo-split-agent.py <todos/TODO-N.md>... [--dry-run]` | the pair, agent half left failing `budget-check` until a human hoists each increment's surface |

## Judge how a diff is built

| Need | Invocation | Returns |
|---|---|---|
| Whether a diff breaks a rule, or gives a wrong result for some input | `/review <todo\|diff>` → one background `reviewrules` run (`review:ref-reviewrules.md` § Run it) | `report.md`: one `<verdict> <severity> <rule id>` line per rule and the findings under each FAIL. Exit 0 = green, 1 = a FAIL or a confirmed hypothesis, 2 = the run did not finish |
| Whether a file that no TODO lists must change when a TODO lands | `code:sub-verify.md` § Phase 1b → one `Agent(subagent_type: "wm:hypothesis-checker")` per missed-change hypothesis, all in one message | `CONFIRMED \| REFUTED \| UNSURE` with quoted `file:line` evidence; a CONFIRMED verdict adds the TODO whose `## Files` must list the file |
| Whether the change breaks a DRY, KISS, or SOLID check | `Agent(subagent_type: "good-design-verifier")` with `task:` and `diff:` lines, and an optional `report:` line | `VERDICT: PASS \| FAIL \| ERROR` with one row per slug and location |

## Feed the review its rules

| Need | Invocation | Returns |
|---|---|---|
| The ADR rules as a reviewrules rule dir | `wm-constraints.py <notes>/adr --reviewrules` | writes `<notes>/.reviewrules/config.json` — one `ADR-NNNN/Pn` rule per Property, severity medium, profile heavy — replaces the file each run, and prints its path |

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
| Every countable verify check | `bin/spec-lint.py <notes> [--json]` | the Phase 0 findings — budgets, frontmatter, section sets, Components, increments, Autotest, waves, ADR format, open questions, and the glossary checks GL1–GL6 |
| Whether the glossary holds and the corpus obeys it | `bin/glossary-lint.py <notes> [--code <dir>]... [--undefined] [--json] [--quiet]` | GL1 entry fields, GL2 enforceable Forbidden names, GL3 Forbidden or retired names in use, GL4 Code ownership and Status against the code (needs `--code`), GL5 New terms merged, GL6 dead entries, GL7 clusters and term links; `--undefined` lists compound identifiers no entry holds. Exit 1 = a finding |
| One artifact's budget | `bin/budget-check.py <file>` | over/under, and where it splits |
| Every artifact's budget | `bin/budget-sweep.sh <notes>` | exit 1 when any is over |
| One concept spelled two ways | `bin/term-variants.py <notes>/todos/*.md <notes>/spec.md` | exit 1 and each variant group |
| Whether the spec may advance | `wm-open-questions.sh <notes> [--count\|--slugs]` | the open questions in `QUESTIONS.md`; exit 1 when any is open |
| Archive a superseded or deprecated ADR | `bin/adr-archive.sh` — PostToolUse hook on `Edit\|Write\|Bash`, reads the hook JSON on stdin | moves each live ADR whose last changelog line starts with `Superseded by [ADR-NNNN]` or `Deprecated:` to `adr/archived/`, and prints the live files that still link to it |
| Drop a tactical ADR at session end | `bin/adr-tactical-check.sh` — SessionEnd hook, reads the hook JSON on stdin | finds the ADR files the session wrote or edited (from `transcript_path`), and starts a detached {medium} agent that archives each ADR failing the global tests of the `adr` skill with a `Deprecated: tactical, not global` changelog line; log in `~/.claude/logs/adr-tactical-check/` |
| Where a slow verify spent its time | `wm-verify-profile.py <transcript.jsonl>` | per-phase and per-agent wall clock, turns, tools, tokens |
