# harness-dev glossary

## Golden words

A golden word stands for the public form of a rule block; the house rules beside it stay written out (`skill-build:references/golden-words.md`). One row per word in use. `Tier` is the reader `model:` it passed on, `Model id` the resolved id at that date; the row is stale once the alias moves, and `evals/run-golden-words.sh` re-checks it.

| Word | Stands for | Used by | Tier | Model id | Checked |
|---|---|---|---|---|---|
| ASD-STE100 | the Simplified Technical English writing rules in `~/.claude/CLAUDE.md` | `wm:agents/comment-critic.md` | sonnet, opus (reader `comment-critic` is haiku: not passed there) | claude-sonnet-5-5; opus id not recorded | 2026-10-02 — word arm = word + rules arm, both beat no-word control; haiku broke a recited rule in 2 of 10 runs |
| RFC 2119 | the obligation keywords MUST / SHOULD / MAY in `~/.claude/CLAUDE.md` | every skill | all | — | not run; carried as the existing house pattern |
