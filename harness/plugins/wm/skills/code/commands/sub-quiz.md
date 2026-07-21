# code — quiz (test the human's understanding)

Generate a multiple-choice quiz that checks whether **the human** understands the current work,
grade their answers, report a score. Read-only: quizzes over `spec.md` / the diff, edits no
artifact. Vocabulary: `../GLOSSARY.md`. Spec contract + `status`: `ref-write.md`.

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

## Pick the subject from the phase

Read `spec.md` frontmatter `status` (spec phase `init → review → impl`). Arg overrides:
`/code quiz spec` or `/code quiz code`.

| `status` (or arg) | Subject | Source of truth |
|---|---|---|
| `init` / `review` / `spec` | **the spec** | `spec.md` (Goal, Decisions, Terms), `GLOSSARY.md`, each TODO's Outcome, `thoughts/` |
| `impl` / `code` | **the code changes** | the branch diff (`git diff <target>...HEAD`) + the implemented `todos/TODO-N.md` (Outcome, Changes, Decisions) |

No `spec.md` and no diff → nothing to quiz; say so and stop.

## Build the questions

5–8 questions. Each question tests one fact the human should know, not trivia:

- **Spec quiz** — one question per load-bearing choice: a Goal boundary (in scope vs out), a Decision and *why* it beat the alternative, a Term's exact meaning from `GLOSSARY.md`, a TODO's Outcome, an edge case the spec commits to handling.
- **Code quiz** — one question per real change: which file/function changed, what behavior it now has, why a Decision was made this way, what a hunk does, which caller was migrated.

Per question:
- One correct option grounded in the source. Hold the correct answer + its citation (spec section, or `file:line`) — do not reveal it in the option text.
- 2–3 distractors that are plausible misreadings (a sibling decision, the rejected alternative, an off-by-one boundary), not obvious throwaways. See `dont-game-the-metric` — a distractor no one would pick tests nothing.
- Ask via `AskUserQuestion` (one question per entry, `header` = the subject area). Batch up to 4 per call.

## Grade and report

Compare each answer to the held-correct option. Report in chat and persist to
`<notes-dir>/quiz-<subject>.md`:

```markdown
# Quiz — <spec | code>

Date: YYYY-MM-DD HH:MM
Score: <correct>/<total>

## Missed
- Q<n>: <question> — you: <their pick> · correct: <right answer> (<spec section | file:line>)

## Correct
- Q<n>: <question> ✓
```

For each missed question, state the correct answer and its citation — the quiz teaches, it does
not just score. `jj commit -m "Quiz: <subject> <score>"` in `<notes-dir>`.

Do not touch `spec.md`, `todos/`, or source. A wrong answer is a signal for the human — if it
reveals a real spec gap, tell them to run `/code revise` or `/code fix`; don't edit for them.
