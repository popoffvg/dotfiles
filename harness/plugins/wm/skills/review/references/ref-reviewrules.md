# The reviewrules run

`reviewrules` reads one diff in a parent session, then forks that session once per rule whose
`scope` matches a changed file. Each rule fork returns PASS or FAIL with `file:line` findings. A
generator fork writes correctness hypotheses, and one checker fork answers them. The tool and its
docs are in `~/git/reviewrules`.

## Rule sources

| Source | Where | Loaded by |
|---|---|---|
| repo rules | `.reviewrules/config.json` in the repo and in each nested folder git tracks | the repo itself |
| `wm` | `~/git/dotfiles/harness/reviewrules/.reviewrules/config.json`: the rules of the skills and the gate agents | `rule_dirs.wm` in `~/.config/reviewrules/config.toml` |
| `notes` | `<repo>/.notes/.reviewrules/config.json`: one `ADR-NNNN/Pn` rule per Property of a live ADR | `rule_dirs.notes` |

Each rule has a `profile`: `light`, `medium`, or `heavy`. The `profiles` table of the user config
sets the model, reasoning effort, and steps of each profile. A rule id from a rule dir reads
`<dir name>/<rule id>`, for example `notes/ADR-0003/P2`.

## Run it

1. **Refresh the ADR rules** when `<notes-dir>/adr/` exists:
   `~/.claude/scripts/wm-constraints.py <notes-dir>/adr --reviewrules`. It replaces
   `<notes-dir>/.reviewrules/config.json`, so a removed Property stops binding.
2. **Launch the run in the background** (Bash `run_in_background: true`):

   ```bash
   reviewrules --repo <repo> --base <base> [--worktree] \
     --json-out <notes-dir>/review/<target>/reviewrules.json \
     > <notes-dir>/review/<target>/report.md 2> <notes-dir>/review/<target>/reviewrules.log
   ```

   The run diffs `merge-base(<base>, HEAD)` to `HEAD`. `--worktree` adds the uncommitted changes.
   A range that does not end at `HEAD` needs a checkout of its end first.
3. **Read the exit code.**

   | Exit | Means | Do |
   |---|---|---|
   | 0 | every rule at or above `fail_on` passed | the review is green |
   | 1 | a rule FAIL, or a confirmed hypothesis | route the findings (§ A FAIL goes back to impl) |
   | 2 | the run did not finish: a config error, an empty diff, a broken rule file | report `reviewrules.log` and stop; never call it green |

4. **Decide every `UNSURE` line yourself.** reviewrules rechecks each `UNSURE` hypothesis in its own fork, and a hypothesis that stays `UNSURE` exits 1. Its `missing:` line names the gap. For each one, read the line at its `at` and every caller up to the entry point, as its `look` says. A question that says "always", "never", or "every" needs a quote from each path, early returns included. When reading cannot decide it, write or run a test that does. Write the verdict under `## Verified` in `report.md`: CONFIRMED with the input and the wrong result, or REFUTED with the deciding quote or test. A CONFIRMED verdict is a FAIL: route it like one. The review is green only when every hypothesis has a CONFIRMED or REFUTED verdict. Never report a hypothesis as open or undecided.

## Report files

```
<notes-dir>/review/<target>/report.md          the summary reviewrules prints: one line per rule, the findings under each FAIL
<notes-dir>/review/<target>/reviewrules.json   the full report: verdicts, checks, profile and model per rule, usage, cost
<notes-dir>/review/<target>/reviewrules.log    the run log
```

`<target>` is `TODO-N` in `todo` mode, `TODO-N/inc-<k>` for one increment, and the slug of the
range in `diff` mode: the branch name, the short sha, `pr-<n>`, or `worktree`. Each run overwrites
the files. A missing `report.md` means the run did not happen.

## A FAIL goes back to impl

Copy every FAIL line of `report.md` with its findings into one fixup brief for `impl`
(`impl:sub-commit.md` § Fixups), then run the review again. A `low` FAIL is a nit: it does not fail
the run, and the brief marks it optional.

### Fix a red run in one round

Each rerun finds what the last fix left open. Close it before the rerun:

1. **`fix-the-class`.** A CONFIRMED hypothesis names one path. Ask its question again of every sibling path in the diff: each handler, each write, each exit. A rule finding names some lines: search the whole diff for the same pattern. Fix every hit in one commit. Done when the search finds no other hit.
2. **`self-check-fix-hunk`.** Walk the fix hunk through the hunts of the hypothesis generator prompt and through each rule that failed. Done when the fix adds no new error path, read, or state that the walk did not answer.
3. **`decide-unsure-in-session`.** Decide each `UNSURE` line as step 4 of [Run it](#run-it) says. Pass each REFUTED verdict to the rerun as `--context "<at>: <the deciding quote or test>"`. Never rerun only to get another sample of the same question.
4. Run the review again once. The rerun reuses the cached questions and asks new ones only about the commits since the last run, so a red rerun points at the fix itself.

`auto` passes a budget of five runs. A fifth red run ends the TODO as `status: blocked`, with the
last `report.md` recorded. A standalone `/review` runs once and stops, because a human reads the
report.
