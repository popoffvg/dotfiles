---
name: red-green-refactor
description: >
  Red-Green-Refactor cycle for bug fixes. Before fixing a bug, first write a failing test that
  reproduces it (Red), then make the minimal change to pass (Green), then clean up the code (Refactor).
  Use on any bug fix, error correction, failing test repair, or when user says "fix this bug".
---

# Red-Green-Refactor

Fix bugs test-first. Never change production code before proving the bug with a test.

## The cycle

| Phase | Action | Rule |
|---|---|---|
| **Red** | Write a test that fails because of the bug | The test must pass after the fix but fail before it. If you can't write a failing test, you don't understand the bug yet — ask the user. |
| **Green** | Make the minimal code change to pass the test | One change at a time. No refactoring yet. No scope creep. |
| **Refactor** | Clean up: extract methods, improve names, remove duplication | Do not change behavior. The test from Red must still pass. |

## Red phase — the failing test

1. Identify the exact input that triggers the bug and the expected output.
2. Write the smallest test that fails with the current code.
3. Run it. Confirm it **fails** with the bug's error message.
4. If the test doesn't fail, the bug isn't reproduced — adjust the test or ask the user.

## Green phase — the minimal fix

1. Change **only** the production code, not the test.
2. Make the smallest change that turns the test green.
3. Run the test. It must pass.
4. If the fix breaks other tests → you changed too much. Revert and try a smaller change.

## Refactor phase — clean without breaking

1. Look at the code you and surrounding code changed.
2. Clean: extract methods, rename variables, remove dead code, improve structure.
3. Run **all** tests. They must still pass.
4. No new functionality — behavior is locked by the test suite.

## After the cycle

- Commit: use `fix:` prefix (see `impl-commit`). The message describes the bug, not the fix.
- If multiple bugs: one cycle per bug, one commit per cycle.

## Hard rules

- Never skip Red. A fix without a reproducing test is not a fix — it's a guess.
- Never refactor in Green. Green is minimal — one change, no cleanup.
- Never add new features in Refactor. Behavior is locked.
- If the test is hard to write (requires mocking 5+ services, etc.), stop and ask the user to scope it down.
