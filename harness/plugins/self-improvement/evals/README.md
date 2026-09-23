# self-improvement evals

Plugin-level eval suite. Today it grades one thing: the three gates in `../skills/capture-lesson/SKILL.md`. Add a `cases-<skill>.jsonl` beside `cases.jsonl` when a second skill needs grading.

Gates under test:

- **Step 0 — source** → `correction` | `method` | `discovery` | `decision` (what kind of input this was; `decision`, or a method/discovery failing the bar, means no skill)
- **Step 1 — scope** → `global` | `project` | `skip` (teachability test: would you teach this rule to a new colleague?)
- **Step 1b — form** → `verdict` | `check`

The runner extracts all three sections verbatim from the skill at run time, so the eval always grades the current spec. Change a gate → re-run; change the gate's *contract* (new label, new axis) → update `cases.jsonl` in the same commit.

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
| `id` | — | skill slug the case was taken from, or a slug naming a constructed case |
| `description` | — | the lesson's trigger, as the gate sees it |
| `anchors` | — | what happened, in neutral terms: the wrong action, the state it ran against, what settled it |
| `utterance` | — | what the user said, verbatim. Required to grade `source` |
| `source` | when present | gold label: `correction`, `method`, or `decision` |
| `scope` | yes | gold label: `global`, `project`, or `skip` |
| `form` | yes | gold label: `verdict` or `check` |
| `note` | — | the operator's verdict in their own words, and why |

34 cases. Gold labels are the operator's verdicts, not a reconstruction. Some `discovery` and Step 0 cases are **constructed**, not taken from a real session — replace each with a real captured case as one arrives.

### The judge runs skill-blind (`--disable-slash-commands`)

Discovered 2026-08-01, while adding the `discovery` source: the `claude -p` judge session loads the skills installed on this machine — most eval cases exist there as real skills, so the judge "knew" a case was already filed. This stayed dormant until the Step 0 bar added the phrase "changes no behavior → no lesson"; six cases then flipped to `skip` with rationales naming installed skill slugs the prompt never contained (24/34). Prompt-level ignore-instructions only reduced it (scores wobbled 24→28→29→28 across identical runs) — and planted the "already filed" vocabulary the rationales then echoed. The fix that held: `run.sh` passes `--disable-slash-commands` (disables all skills for the judge) and the prompt keeps only the capture-time viewpoint pin. Keep the flag; a "duplicate of X" rationale that still appears is the judge coining the slug from the case description, and matters only if the *answer* flips.

## Last run

2026-08-01, `MODEL=sonnet`, three gates, 34 cases, skill-blind judge: **32/34 joint** (scope 32/34, form 34/34, source 16/16), accuracy 0.94.

`authoring-model-invocable-skills` and `check-local-vault-before-web` are flaky. Treat a single failure on a flaky case as noise; two runs in a row as a signal.

**A new gate section leaks into the existing ones.** Re-run the whole suite after adding one, and read the `-v` rationales of any flip — the leak shows up in the wording before it shows up in a score.

## Known weaknesses of this suite

Read these before quoting a score.

- **`source` is graded on 8 of 26 cases.** The other 18 predate Step 0 and never recorded what the user said, so the source axis has no input to run on there — the label was removed rather than guessed. Distribution of the 8: 2 `correction`, 4 `method`, 2 `decision`; always-`method` scores 0.50.
- **Five of the six Step 0 cases are constructed**, written in the same session as the gate they grade. They test that the gate reads its own table, not that it survives a real transcript. Only the two pre-existing cases carry an `utterance` recovered from a real session.
- **`decision` is only tested by the easy shape.** Both `decision` cases are a bare pick with no reason. The hard case — a pick *with* a transferable reason, which Step 0 says is a `method` — is untested. Add it when it happens.
- **The form axis has 2 discriminating cases of 26.** Always-`verdict` scores 24/26 on that axis. A high form score is still not evidence the ambiguity gate works.
- **Scope is imbalanced 17 global / 7 project / 2 skip.** Always-`global` scores 0.65 — treat anything at or below that as broken, not as partial credit. Both `skip` cases arrived with Step 0; before that the suite could not detect over-capture at all.
- **`anchors` is written by the same agent that set the gold label.** It is a neutral retelling of the incident, but a phrase that hints at the answer leaks it. When a case passes, check the model's `-v` rationale: if it quotes `anchors` back rather than reasoning about recurrence, the case is measuring reading, not judgment.
- **`anchors` is a summary, not the raw transcript.** Build new cases from an archived transcript under `~/.claude/self-improvement/lessons/` — that is the input the gate really runs on.

## Mining new cases from real sessions

`mine-cases.workflow.js` addresses the two weaknesses above marked **constructed** and **anchors-is-a-summary**: it pulls candidates from real transcripts instead of hand-writing them.

Run it from a Claude Code session:

```
Workflow({ scriptPath: "<this dir>/mine-cases.workflow.js", args: { max: 5 } })
```

Phases: **Scan** (recent transcripts with ≥3 user text messages) → **Extract** (per session, ≤2 moments where the user corrected, stated a method, or made a pick — verbatim words) → **Label** (apply the gates, then argue the opposite; a close opposite argument marks the case `boundary`) → **Assemble** (dedup against `cases.jsonl`, write `candidates-for-review.jsonl`).

It never writes `cases.jsonl`. Review `candidates-for-review.jsonl` by hand — the gold label is the operator's call, not the miner's — then move the accepted lines over. Prefer the `boundary` ones; a case both sides agree on measures nothing.

## Adding a case

Take it from an archived transcript under `~/.claude/self-improvement/lessons/`: `description` = the skill's trigger, `anchors` = what happened, `utterance` = the user's words verbatim, `source`/`scope`/`form` = the decision that turned out right, `note` = the operator's words. Omit `source` only when the case has no recorded utterance. Prefer cases where the gates disagree with the obvious answer — those are the ones that measure anything.
