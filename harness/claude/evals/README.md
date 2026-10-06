# Evals for loose `~/.claude` skills

| Runner | Cases | Grades |
|---|---|---|
| `run-grilling-rounds.sh` | `cases-grilling-rounds.jsonl` | **The pain.** The `grilling` skill writes whole real rounds; the runner counts the needless questions and the missed ones. |
| `run-grilling.sh` | `cases-grilling.jsonl` | Diagnostic only. One open point at a time, with the labels named in the prompt. It cannot tell a good skill from a bad one. |

`lib-grilling.sh` holds what both runners share: the skill text at a git revision, the judge call, and the job limit.

---

# The pain these suites measure

The user wants grilling to ask only the questions that the user alone can answer. In 154 real blocks, only 26 answers (17%) gave a fact that the model could not have found. The rest were a bare letter, "yes", "agree", or empty. The causes, from those answers:

| Pain point | Shape | Gold |
|---|---|---|
| `earlier-session` | repeats a point that an earlier session or grill settled ("do nothing, prev session" ×6) | not asked |
| `own-words` | asks the user to confirm the user's own comment or earlier answer | not asked |
| `straw-man` | only one option is real; the other keeps the defect the change removes | not asked |
| `repo-rule` | a repo rule or the code already settles it | not asked |
| `mechanical` | branch name, file location, hash format, an algorithm behind an interface | not asked |
| `user-owned-value` | a value the user sets in a tool after the change | not asked |
| `dependent` | asked in the same round as the open question it depends on | not asked |
| `intent-fork` | two defensible options; only the user's priority picks one | asked |
| `literal-reading` | the user's words have more than one meaning; the answer rejected all options | asked |
| `scope-override` | a source (the spec) limits scope, but the user may lift the limit | asked |

The first seven are **needless questions** (over-ask): the defect the user reported. The last three are **needed questions**: a fix that makes the model decide them is the opposite defect (under-ask). Read both counts. A skill that never asks has zero needless questions.

---

# Suite: whole rounds (`run-grilling-rounds.sh`)

## What it does

Each case is one real round: the material the model had (the user's comments verbatim, quotes from earlier grills, notes, rules, and code) and every open point the model drafted. The model gets the skill and the case, and writes the round file. Each block it writes for the user must start with `### [decide] P<n>:`. A point with such a block is asked; every other point is not. Gold labels come from the user's real answers.

**The prompt must never name the choice to decide or to wait.** v0.1.0 has neither. An earlier draft of this runner said "if you settle a point yourself, write a line", and v0.1.0 then asked only 24 of 108 points. That graded the prompt, not the skill. With the neutral prompt, v0.1.0 asks every point, which is what it did in the real sessions.

The model has no tools (`--tools ""`). With tools, it tried to write the round with `Write`, was refused, and replied in prose with no headings.

## Run

```sh
./run-grilling-rounds.sh                      # current skill, all rounds
SKILL_REV=6402ad2 ./run-grilling-rounds.sh    # the control: v0.1.0, which over-asked
REPEATS=3 ./run-grilling-rounds.sh            # write each round 3 times (default: 1)
./run-grilling-rounds.sh -i <round-id> -k     # one round; keep the written files to read them
```

Env: `MODEL` (default `sonnet`), `JOBS` (default 4), `MAX_NEEDLESS` (share of asked blocks, default 0.25), `MAX_MISSED` (share of needed questions, default 0.2). Exit 0 = both shares within the limits and no empty reply.

The report has one row per round (real blocks, needed, asked, needless, missed), one row per pain point, and the line `real sessions: …` for the baseline. A round with no question heading is listed by name: read it with `-k` before you trust a zero.

## Always run the control

Run `SKILL_REV=6402ad2` beside every change. If v0.1.0 stops asking almost everything, the runner or the cases leak the answer, and the score of the new skill means nothing.

## Cases

`cases-grilling-rounds.jsonl`, one round per line: `id`, `caller`, `source`, `context` (≤2000 chars, never this round's answers), `blocks` (`n`, `candidate`, `label`, `pain`, `answer`), `note`. A `skip` block stays in the round as noise and is not scored.

| Round | Caller | Blocks | Needed | What it shows |
|---|---|---|---|---|
| `line-comments-settled-by-earlier-session` | line-comment act | 8 | 0 | every block repeats an earlier session |
| `adr-split-root-question-open` | other | 8 | 1 | 7 blocks depend on the open root question |
| `installation-entity-round-1` | line-comment act | 8 | 1 | one real design fork among confirmations |
| `installation-entity-round-2` | line-comment act | 3 | 0 | round 1 answers settle all of round 2 |
| `todo-41-comments-v020` | line-comment act | 3 | 1 | written under v0.2.0; one literal-reading redirect |
| `supervoc-root-design` | wm spec | 9 | 5 | a new product: most questions are real |
| `golden-words-after-critic` | critic | 8 | 2 | measured data turned into confirm blocks |
| `migration-recreate-or-keep-in-place` | other | 8 | 2 | `[review]` blocks that a source settles |

Known gaps in the data:

- `line-comments-settled-by-earlier-session` — the earlier session's records are gone. The context states that it settled the six spec.md comments.
- `adr-split-root-question-open` — the user's request is taken from the grill title.
- `installation-entity-round-2` — the context is cut at 2000 chars in the middle of a sentence.
- Three blocks whose answer was new information are labelled `dependent`, because they depend on an open sibling.

## Last run

2026-10-06, `MODEL=sonnet`, `REPEATS=3`, 8 rounds × 3 = 162 scored blocks, 36 needed.

| Skill | Asked | Needless | Missed | Rounds over 5 questions |
|---|---|---|---|---|
| real sessions | 162 | 126 (78%) | 0 | — |
| v0.1.0 (`6402ad2`) | 162 | 126 (78%) | 0 of 36 | 18 of 24 |
| v0.2.0 (worktree) | 33 | **19 (58%)** | **22 of 36 (61%)** | 0 |

v0.1.0 reproduces the real sessions exactly, so the suite can see the pain. v0.2.0 asks 80% fewer questions, but it picks the wrong ones:

- **It decides the needed questions.** 15 of the 22 misses are `intent-fork`, 4 are `scope-override`, 3 are `literal-reading`. In `todo-41-comments-v020` it decided all 3 points in every run, also the log shape that the user's real answer rejected ("s3 bucket definetly has append API").
- **It still asks dependent questions.** 8 of its 19 needless questions are `dependent`, all in `adr-split-root-question-open`. It asks the Q1 children next to Q1.
- **It still asks own-words, mechanical, earlier-session, and repo-rule points** in `line-comments-settled-by-earlier-session` and `migration-recreate-or-keep-in-place`.

---

# Suite: one point at a time (`run-grilling.sh`) — diagnostic

## Why it does not measure the pain

The judge gets one open point and is told to answer `ask`, `decide`, or `defer`. The prompt names the choices that v0.1.0 does not have, and many contexts state the conclusion ("an earlier session already settled this"). The control proves it:

| Skill | Score | Over-ask | Under-ask |
|---|---|---|---|
| v0.1.0 (`6402ad2`) | 33/34 (0.97) | 0 of 21 | 1 of 13 |
| v0.2.0 (worktree) | 31/34 (0.91) | 1 of 21 | 2 of 13 |

The version that asked all 21 needless questions in real sessions scores best. Use this suite only to find out whether a rule is missing or is not applied. If a point fails here too, the rule text cannot sort it even when the choice is named. If a point passes here and fails in the round suite, the rule exists, but the model does not apply it while it writes a round.

## Run

```sh
./run-grilling.sh                 # all cases
./run-grilling.sh -p dependent    # one pain point
./run-grilling.sh -i <case-id> -v # one case, with the judge's rationale
```

Env: `MODEL`, `SKILL_REV`, `JOBS`, `THRESHOLD` (default 0.85), `MAX_OVER_ASK` (default 1).

## Cases

`cases-grilling.jsonl`: `id`, `caller`, `source`, `context`, `candidate`, `label` (`ask` | `decide` | `defer`), `pain`, `answer`, `note`. 34 cases: 13 `ask`, 14 `decide`, 7 `defer`. Four cases contain text that the case builder wrote: `cursor-type-waits-on-log-shape` (from a Decided line), `repeat-of-earlier-session` (the earlier records are gone), `only-one-real-option` (option B is added filler), and `redirect-own-design` (a multi-line answer joined into one line).
