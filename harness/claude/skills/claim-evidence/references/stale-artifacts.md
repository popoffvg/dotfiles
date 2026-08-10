# Rule out stale artifacts before calling it red

A test failure you did not cause is a claim about someone else's work. Verify the environment before publishing the verdict, because a stale artifact produces a failure that is indistinguishable from a real one: a real assertion diff, a real line number, a real red summary. Nothing in the output hints that the file on disk and the code being executed differ.

The asymmetry matters. A false green wastes your own time later. A false red **accuses** — it sends the author back to hunt a defect that was never there, and it is published before anyone can check it.

## Before reporting the failure

1. **Read the source the test disagrees with.** If the file on disk already says what the test expects, the code being executed is not the code you read. Stop — that is the signal, and it is easy to miss because the natural reading is "the author got it wrong twice".
2. **Clear the caches for that toolchain and re-run.** Common carriers:

   | Ecosystem | Stale carrier |
   |---|---|
   | Python | `__pycache__/*.pyc`, `.pytest_cache/`, an installed copy in the venv shadowing `src/` |
   | Node / TS | `node_modules/.vite`, `.turbo/`, `*.tsbuildinfo`, a stale `dist/` |
   | Rust / Java | `target/`, `.gradle/`, incremental build dirs |
   | Any | a previous build's output still on the import or link path |

3. **Confirm the module under test resolves to the file you read** — print `__file__`, `require.resolve`, or the equivalent. A second copy on the path is the case caches do not explain.
4. **Re-run and only then report**, quoting the clean run.

## When it turns out to be your environment

Say so plainly and correct the earlier claim in the same breath — the author may already be acting on it. Do not quietly re-run and report the pass as if the first result never happened; the false accusation is the part worth retracting.

## When it is still red after a clean run

Report it with the clean-run output and say the caches were cleared. That sentence is what makes the finding trustworthy, and it costs one clause.
