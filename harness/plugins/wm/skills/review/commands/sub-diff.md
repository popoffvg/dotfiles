# review — diff

Judge a diff no TODO pair covers: the working tree, a commit range, a branch against its base, or a
PR. Same gates, same tiers, same wave — the only difference is what the outcome gate has to judge
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
   intent falls back to judging style, which is what the cheap wave already does.
3. **Run the cheap wave** — @lint-tester, @comment-critic, and @name-critic in **one message**. All
   three work unchanged without a pair: the linter reads the repo config, the comment gate judges
   each comment against the code under it, the name gate judges each name against its own body. The
   lint gate runs the tests covering the changed files, since no `## Autotest` command exists.
4. **Run the test gate** — @tester over the diff, not in TODO mode. The question becomes: does a
   test assert the behavior this diff changed? It reports the gap; in this mode it **writes nothing**
   — there is no implementer to fold a test into and no commit to amend.
5. **Run the outcome gate** — @reviewer with § No pair below in its brief.
6. **Report** — the roster's report shape, with the resolved range and the derived intent sentence at
   the top.

## No pair: what the outcome gate judges instead

**The intent sentence replaces the Outcome.** The gate asks whether the diff delivers the intent
derived in step 2, and it says so when the intent itself is unclear from the commits — an unclear
intent is a finding about the change, not a reason to pass it.

**The repo replaces the Surface and the rules file.** With no approved signatures, a new symbol is
judged against the conventions of the files around it and the rules in `CODE_STYLE.md`.
A signature that breaks a caller is still a Failure; a signature that is merely unlike the one a
spec would have picked is not.

**Correctness and duplication are unchanged.** Both are read from the code alone, so they need no
pair: off-by-one, nil and empty and zero, a swallowed error path, a race on a new shared value, an
unmigrated caller after a signature change, and a fact left in two places that can disagree.

**Spec drift becomes scope.** With nothing approved there is no drift to find, so the gate reports
scope instead: a change in the diff that the intent sentence does not account for. It is a Nit when
it is a tidy-up and a Failure when it changes behavior nobody asked to change.
