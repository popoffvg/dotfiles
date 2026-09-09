# Grill phase — generate questions FOR the explorer

The `explorer` agent works better with a sharp question list. Use `grill-me` not to interview the
user but to **interrogate the entry point itself**: a separate Claude CLI process acts as a paranoid
reviewer and produces the questions the explorer must answer.

**What a `<ep-slug>.questions.md` must contain is `examples/questions.md`** — the agenda filled for
one real entry point, with the rules for each of the seven required sections as the `>` block under
it. The CLI call below points the grilling process at that file rather than restating the sections.

For each entry point, spawn one CLI call (these can run in parallel via shell `&`):

```bash
EP="<entry-point>"
EP_SLUG="<ep-slug>"
QFILE="$RESEARCH_DIR/$EP_SLUG.questions.md"
EXAMPLE="$CLAUDE_PLUGIN_ROOT/skills/dive-docs/examples/questions.md"

cat <<PROMPT | claude --model haiku --print --output-format text > "$QFILE"
/grill-me

You are NOT interviewing a human. You are grilling the codebase entry point below to generate a research agenda for another agent (the "explorer") that will read the code and answer your questions.

Entry point: $EP
Task context: <one-line task description>

Read $EXAMPLE first. It is the agenda filled for a different entry point: its seven sections, in that order, are the ones you must produce, and the \`>\` block under each section states what that section's questions must ask and when they are wrong. Delete the \`>\` blocks from what you write — they are rules, not content.

The explorer will use your questions to populate a refactor-oriented artifact graded against a 6-step chain: entry point → tests → follow data → skip noise → failure path → one-sentence trace. Bias your questions so the explorer is forced to satisfy every step.

Each question must be answerable by reading the code. Be specific and adversarial — assume the code has hidden complexity. No questions for humans.
PROMPT
```

Outputs: one `<ep-slug>.questions.md` per entry point in `$RESEARCH_DIR`. Required input to the
matching `explorer` agent.

Notes:
- `--print` keeps it non-interactive: the CLI generates the question list and exits.
- If `claude` CLI is unavailable, invoke `grill-me` in-session (sequentially per entry point) to produce the same `.questions.md` files, reading `examples/questions.md` for the required sections.
