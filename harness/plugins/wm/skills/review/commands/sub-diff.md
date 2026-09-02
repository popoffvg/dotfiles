# review — diff

Judge a diff no TODO pair covers: the working tree, a commit range, a branch against its base, or a
PR. Same gates, same tiers, same wave — the only difference is what the standards gate can cite
against, because nothing was approved in advance.

The roster is @../references/ref-gates.md. This file adds only what changes when the pair is absent.

Obeys the shared subcommand rules (`code:ref-subcommand-rules.md`); **source stays read-only**. This
mode reports and stops — it runs no fixup loop, because a human is reading the report.

## Steps

1. **Resolve the target into one revision range.** The caller names it; resolve it before spawning
   anything, and say what you resolved:

   | The caller said | The range |
   |---|---|
   | nothing | the uncommitted working tree — `git diff HEAD` |
   | `last` | the last commit — `git show HEAD` |
   | a branch | that branch against its merge base with the default branch |
   | a sha or a range | exactly that |
   | a PR url or number | the PR's head against its base (`gh pr diff`) |

   An empty range stops here and is reported as empty, never as a green run.
2. **State the intent in one sentence.** No pair says what the change is for, so derive it from the
   commit messages in the range and put that sentence in every gate's brief. A gate with no stated
   intent falls back to judging style, which is what the four haiku gates already do.
3. **Run the wave** — @lint-tester, @comment-critic, @name-critic, @test-critic, and @reviewer in
   **one message**, each with its own `report: <notes-dir>/review/<slug>/<gate>.md` line, where
   `<slug>` is the range resolved in step 1 (§ Every gate writes its report to a file). All five work
   unchanged without a pair: the linter reads the repo config, the comment gate judges each comment
   against the code under it, the name gate judges each name against its own body, @test-critic
   judges each added test against the body it calls, and @reviewer gets § No pair below in its brief.
   The lint gate runs the tests covering the changed files, since no `## Autotest` command exists.
4. **Run the test gate** — @tester over the diff, not in TODO mode,
   `report: <notes-dir>/review/<slug>/test.md`, once the wave is green. The question becomes: does a
   test assert the behavior this diff changed? It names the gap in its report and **writes no test**
   here — there is no implementer to fold one into and no commit to amend. The report file it always
   writes.
5. **Report** — the roster's report shape, with the resolved range and the derived intent sentence
   at the top, written to `<notes-dir>/review/<slug>/report.md` and returned.

## No pair: what the standards gate loses

**Nothing about the spec, because no gate judged it anyway.** The chain answers "is it built right"
in both modes (`ref-gates.md` § No gate judges the spec), so `diff` mode loses no question — it
loses citations.

**The repo's own files carry the whole rule load.** With no `CONSTRAINTS.md` and no `PATTERNS.md`,
the standards gate falls to sources 1, 2, 5, and 6 of its list: the `CLAUDE.md` files, the house
style docs, the code around the diff, and the language idiom. A breach it would have cited as
`R<n>` now cites a neighbouring file instead, which makes it a Nit more often.

**Correctness is unchanged.** It is read from the code alone, so it needs no pair: off-by-one, nil
and empty and zero, a swallowed error path, a race on a new shared value, an unmigrated caller after
a signature change, and a fact left in two places that can disagree.

**The intent sentence is context, not a contract.** Step 2's sentence goes in the brief so the gate
knows what the code is trying to do while judging how it is built. The gate never rules on whether
the diff delivers it — an unclear intent is worth one Nit line and nothing more.
