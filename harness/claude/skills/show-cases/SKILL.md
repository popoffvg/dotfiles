---
name: show-cases
description: Write every test case and every failure (a bug, a failing test, a review finding) as a Gherkin scenario with a slug name, and put the actual result of a failure under its Then. Loaded by the show-me router for "show the test cases" and "describe the failure".
user-invocable: false
---

# show-cases — Gherkin scenarios

**Every test case and every failure is a Gherkin scenario**, fenced as ` ```gherkin `, in chat and in md files. Prose such as "it breaks when the cache is stale" is not a failure description. Write each scenario to the BRIEF checks in [`wm:test-suite` bdd](../../../plugins/wm/skills/test-suite/references/sub-bdd.md#brief--the-six-checks-for-one-example). A runnable `.feature` file is that skill's job, not this one.

- Name each scenario with a slug that says the behavior: `Scenario: save-invalidates-changed-content`.
- For a failure, `Then` says what must happen. A `# actual:` comment under it says what happened, with the `path:line` or the test that shows it.

```gherkin
Scenario: save-invalidates-changed-content
  Given the cache holds "v1" for "notes.md"
  When save writes "v2" to "notes.md"
  Then the next read of "notes.md" returns "v2"
  # actual: returns "v1" — the entry is never invalidated, src/session/cache.ts:31
```

