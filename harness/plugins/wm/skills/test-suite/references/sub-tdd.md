# TDD — drive the code from the cases

Behaviour first, code second. This subcommand takes a test set that already exists — the big
cases from `sub-create.md` or `sub-write.md` — and turns it into working code one failing test at
a time.

## The loop

**Discovery** clarifies what the system should do, in examples rather than adjectives. **Formulation**
writes those examples as scenarios: Given the state, When the event, Then the observable. See
[`ref-gherkin-guide.md`](ref-gherkin-guide.md) for the syntax and the file layout, and
[`ref-bdd-best-practices.md`](ref-bdd-best-practices.md) for the discovery practice.
**Automation** implements them with red, green, refactor.

- **Red** — write the failing test for one variant, and watch it fail for the reason you expect.
- **Green** — write the least code that passes it.
- **Refactor** — clean up with the test still green.

## The iron law

> No production code is written without a failing test first.

Code written before its test costs three things. You never learn whether the test can fail, so a
false positive can sit there for years. Your test is shaped by the implementation you already
wrote, so it asserts what the code does rather than what the behaviour requires. And you have
written legacy code on day one — code whose specification exists only in someone's memory.

## Order the work by big case

Take the big cases in the order the reader would care about, and finish one before starting the
next. Inside a case, the smoke variant goes first, then the boundaries, then the failures. A
half-finished big case is worse than an untouched one: the heading claims a behaviour is covered
while its edge variants are still missing.

**Name the test function after the variant.** `Test_expired_token_is_rejected`, not `TestRefresh2`
and not `TestUPair1`. The name in the code, the bold name in the `.md`, and the Gherkin tag are
the same string, so a red test in CI names the behaviour that broke without anyone opening the
test set.

## Scenarios live in `.feature` files

Store them as files, never as code comments. A comment is invisible to the runner and to everyone
who does not read the source, which is exactly the audience a scenario is written for. Keep them
declarative — the business behaviour, not the UI path — and one behaviour per scenario.
