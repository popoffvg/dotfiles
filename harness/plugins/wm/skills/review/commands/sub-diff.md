# review — diff

Judge a diff no TODO pair covers: the working tree, a commit range, a branch against its base, or a
PR. Same gates, same tiers, same wave — the only difference is the rule sources, because nothing
was approved in advance.

The roster is @../references/ref-gates.md. This file adds only what changes when the pair is absent.

Obeys the shared subcommand rules (`code:ref-subcommand-rules.md`); **source stays read-only**. This
mode reports and stops — it runs no fixup loop, because a human is reading the report.

## Steps

1. **Resolve the target into one revision range.** Say what you resolved:

   | The caller said | The range |
   |---|---|
   | nothing | `worktree` — the uncommitted tree, untracked files included |
   | `last` | `HEAD~1..HEAD` |
   | a branch | `<merge base with the default branch>..<branch>` |
   | a sha or a range | exactly that |
   | a PR url or number | `<base>..<head>` of the PR, after `gh pr checkout` or a fetch of both |

   An empty range stops here and is reported as empty, never as a green run.
2. **State the intent in one sentence.** No pair says what the change is for, so derive it from the
   commit messages and put that sentence in the correctness gate's brief. It is context, not a
   contract: no gate rules on whether the diff delivers it.
3. **Plan the rules gate** — `wm-rule-batches.py plan --notes-dir <notes-dir> --range <range>
   --out <notes-dir>/review/<slug>/rules`, where `<slug>` is the range's slug
   (`../references/ref-gates.md` § Every gate writes its report to a file). No notes-dir → omit
   `--notes-dir`; the global rules still apply. Exit 2 names a broken rule file: report it and stop.
4. **Batch the mutation gate.** Split the changed source files into batches and derive each batch's
   narrowed test command (`mutation:SKILL.md` § Run it). No changed file a test covers → `n/a`.
   Under `fast`, skip this step.
5. **Run the change probes.** Write `<notes-dir>/review/<slug>/probes.json` and run every probe
   (`../references/ref-gates.md` § A gate whose input did not change passes without running). This
   mode runs one round, so `$SINCE` is the base of the range: a gate the diff gives nothing to judge
   is skipped as PASS.
6. **Run the wave** — in **one message**, every gate step 5 did not skip: @lint-tester, one @rule-checker per batch line step 3
   printed, @idiom-critic, @correctness-critic, and one @mutation-tester per batch from step 4, each
   with its own `report: <notes-dir>/review/<slug>/<gate>.md` line. Every mutation agent gets the
   `checkout:` line (`mutation:SKILL.md` § 3) and no `isolation`. The lint gate runs the tests
   covering the changed files, since no `## Autotest` command exists. When the last @rule-checker
   returns, spawn the @rule-reducer with `rules: <notes-dir>/review/<slug>/rules` and
   `report: <notes-dir>/review/<slug>/rules.md`.
7. **Run the test gate** — @tester over the diff, not in TODO mode,
   `report: <notes-dir>/review/<slug>/test.md`, once the wave is green and the `test` probe printed a
   line. It names the gap and
   **writes no test** here: there is no implementer to fold one into. Under `fast`, skip this step.
8. **Report** — the merged shape in `../examples/report.md`, with the resolved range and the intent
   sentence at the top, written to `<notes-dir>/review/<slug>/report.md` and returned.

## No pair: what the gates lose

**Only the `D<NNN>` rules.** The rule files in `<notes-dir>/rules/` and `~/.notes/rules/`, and the
project's `RULES.md` and `PATTERNS.md`, apply in both modes. With no TODO there is no `--todo`, so
no settled decision becomes a rule.

**Correctness is unchanged.** It is read from the code alone, so it needs no pair.
