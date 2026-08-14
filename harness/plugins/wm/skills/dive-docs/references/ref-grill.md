# Grill phase — generate questions FOR the explorer

The `explorer` agent works better with a sharp question list. Use `grill-me` not to interview the
user but to **interrogate the entry point itself**: a separate Claude CLI process acts as a paranoid
reviewer and produces the questions the explorer must answer.

For each entry point, spawn one CLI call (these can run in parallel via shell `&`):

```bash
EP="<entry-point>"
EP_SLUG="<ep-slug>"
QFILE="$RESEARCH_DIR/$EP_SLUG.questions.md"

cat <<PROMPT | claude --model haiku --print --output-format text > "$QFILE"
/grill-me

You are NOT interviewing a human. You are grilling the codebase entry point below to generate a research agenda for another agent (the "explorer") that will read the code and answer your questions.

Entry point: $EP
Task context: <one-line task description>

The explorer will use your questions to populate a refactor-oriented artifact graded against a 6-step chain: entry point → tests → follow data → skip noise → failure path → one-sentence trace. Bias your questions so the explorer is forced to satisfy every step.

Produce a markdown file with sections:

## Intent / test questions (tests-first)
- Which tests exercise this path, and what intent does each pin (the behaviour the code must keep)?
- Is any part of the path UNTESTED? Which branch has no test?
- Do the tests reveal intent the implementation hides (edge cases asserted, error messages pinned)?

## Workflow-step questions
- What are the ordered atomic steps from entry to exit on the happy path?
- For each step, what is the exact file:line and what state does it touch?

## Decision-point questions
- What every \`if\`/\`switch\`/dispatch table branches on; what fields it checks; what each branch does differently.
- Where the code forks into parallel paths (prerun/main, sync/async, fast-path/slow-path) and what carries identity across the fork.

## Edge-case questions (adversarial)
- Empty inputs, single-element inputs, duplicate keys, key collisions.
- Race conditions, iteration-order non-determinism, concurrent mutation.
- Partial failure mid-loop: what state has already been mutated and is there a rollback?
- Deleted/missing referenced resources, stale caches, encoder ambiguity (same input → different serialisation?).
- Silent overwrites, silent drops (\`continue\` on missing field), asymmetric branches across similar handlers.

## Identity & invariant questions
- What is "identity" at each layer (handle string, resource ID, hash, axis key, …) and how is equality defined?
- Which fields are mutable vs locked-after-creation? Which are part of dedup keys vs annotations?

## Refactor-hotspot questions
- Which surfaces couple multiple files (schema + dispatcher + handler)?
- Which contracts are implicit (cache key formula, iteration order, name canonicalisation)?
- Where would a future change most likely cause silent data loss or stale cache?

## Surprises / gotchas
- What would a new contributor most likely get wrong?

Each question must be answerable by reading the code. Be specific and adversarial — assume the code has hidden complexity. No questions for humans.
PROMPT
```

Outputs: one `<ep-slug>.questions.md` per entry point in `$RESEARCH_DIR`. Required input to the
matching `explorer` agent.

Notes:
- `--print` keeps it non-interactive: the CLI generates the question list and exits.
- If `claude` CLI is unavailable, invoke `grill-me` in-session (sequentially per entry point) to produce the same `.questions.md` files.
