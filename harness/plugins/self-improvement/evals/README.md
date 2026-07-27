# self-improvement evals

Plugin-level eval suite. Today it grades one thing: the two gates in `../skills/capture-lesson/SKILL.md`. Add a `cases-<skill>.jsonl` beside `cases.jsonl` when a second skill needs grading.

Gates under test:

- **Step 1 — scope** → `global` | `project` | `skip` (teachability test: would you teach this rule to a new colleague?)
- **Step 1b — form** → `verdict` | `check`

The runner extracts both sections verbatim from the skill at run time, so the eval always grades the current spec. Change a gate → re-run; change the gate's *contract* (new label, new axis) → update `cases.jsonl` in the same commit.

## Run

```sh
./run.sh                 # all cases
./run.sh -i <case-id>    # one case
./run.sh -v              # also print the model's one-line rationale
MODEL=opus ./run.sh      # override the model (default: sonnet)
THRESHOLD=0.9 ./run.sh   # exit non-zero below this joint accuracy (default: 0.85)
```

Needs `claude` and `jq` on `PATH`. Exit 0 = accuracy ≥ threshold.

## Cases

`cases.jsonl`, one JSON object per line:

| Field | Graded | Meaning |
|---|---|---|
| `id` | — | skill slug the case was taken from |
| `description` | — | the lesson's trigger, as the gate sees it |
| `anchors` | — | what happened, in neutral terms: the wrong action, the state it ran against, what settled it |
| `scope` | yes | gold label: `global`, `project`, or `skip` |
| `form` | yes | gold label: `verdict` or `check` |
| `note` | — | the operator's verdict in their own words, and why |

All 20 cases are real skills `capture-lesson` wrote between 2026-07-19 and 2026-07-27. The gold labels are the operator's per-skill verdicts from the scope review, not a reconstruction — including the two where the operator overruled the reviewing agent (`describe-in-house-vocabulary` → global, `draw-diagrams-with-layout-engine` → project).

## Last run

2026-07-27, `MODEL=sonnet`, teachability gate: **20/20 joint** (scope 20/20, form 20/20).

A saturated suite proves nothing about the gate. It says the cases are too easy — the gold labels were written from the same incidents in the same session, so the anchors and the labels agree by construction. The suite's value starts when a gate change makes a case flip; until a case fails, treat 20/20 as a regression tripwire, not as evidence the gate is right.

Six cases (`delegate-dont-drop-duplicate-handler`, `draw-diagrams-with-layout-engine`, `separate-field-for-validated-vocabulary`, `match-signals-to-bundled-consumer`, `update-evals-with-skill-spec`, `skill-scoped-hooks`) name skills that no longer exist: the operator dropped them from `~/.claude/skills` rather than move them into the projects they belong to. The `project` label stands — it is the gate's correct answer for those lessons. Do not relabel them `skip`; the deletion was about not touching those repos, not about the lesson being worthless.

## Known weaknesses of this suite

Read these before quoting a score.

- **The form axis has one discriminating case.** 19 of 20 are `verdict`; only `search-by-identity-not-expected-filename` is labelled `check`. Always-`verdict` scores 19/20 on that axis. A high form score is not evidence the ambiguity gate works — add `check` cases as they are captured.
- **No `skip` case at all.** `skip` is a live outcome of Step 1 and the suite cannot detect over-capture: a model that never skips loses nothing. The next lesson judged not worth keeping should be labelled and added.
- **Scope is imbalanced 14 global / 6 project**, the same skew the gate exists to fix. Always-`global` scores 0.70 — treat anything at or below that as broken, not as partial credit.
- **`anchors` is written by the same agent that set the gold label.** It is a neutral retelling of the incident, but a phrase that hints at the answer leaks it. When a case passes, check the model's `-v` rationale: if it quotes `anchors` back rather than reasoning about recurrence, the case is measuring reading, not judgment.
- **`anchors` is a summary, not the raw transcript.** Once `CASE.md` files exist (Step 4), build cases from their `Task` / `What I did` / `Correction` fields — that is the input the gate really runs on.

## Adding a case

Take it from a skill's `CASE.md`: `description` = the skill's trigger, `anchors` = the case's Repo + What I did, `scope`/`form` = the decision that turned out right, `note` = the operator's words. Prefer cases where the two gates disagree with the obvious answer — those are the ones that measure anything.
