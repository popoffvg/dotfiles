# Strict-judge experiment, week 2026-10-26

Question: does a cause trace plus a strict judge turn a week of corrections into fewer and better notes than the prompts-only suggestion, and how fast does it react?

The code now runs in the scan: `scripts/judge-session.py` per session, `scripts/judge-week.py` in `/dream`, with the prompts in `skills/dream/references/`. The raw run is in `~/.claude/self-improvement/experiments/strict-judge/week-44/`.

## Result

18 sessions scored 6 or more, 2026-10-26 to 2026-10-30.

| Measure | Value |
|---|---|
| Causes traced | 83, plus 6 producer groups |
| Judge ACCEPT | 4 |
| Final notes (replay catches the defect) | 3 |
| Cost | $36.38 in 120 calls, about $2 per session |
| Correction to note, per cause | median 3.2 min, max 5.9 min; the trace is 85% of it |
| Rejects | `strong-signal` 46, `not-covered` 22, `reaches-past-task` 17 |
| Later corrections prevented in the week | 0; the matcher control linked 3 of 3 notes to their own cause |

Of the 22 `not-covered` rejects, 11 were fixed in the same session, and 11 were rules that exist and that the agent broke.

## Positive control

Session `a221503e` (TODO-10) has four causes that the operator traced by hand in `29624ea2`. The trace found the class (five causes whose input is the TODO), but it did not link "why do we need 2 mutex?" to `TODO-10.agent.md` line 34 ("under one mutex"). The judge accepted nothing from `a221503e`, and it rejected the prompts-only suggestion (a KISS section in `CLAUDE.md`) on `checkable`.

## Limits

- One week is too short to show prevented corrections.
- The impact matcher is a model call; its control shows only that it links a note to its own cause.
- The blocking cost of a live hook in the operator's session was not measured.
