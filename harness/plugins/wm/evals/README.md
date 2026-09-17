# wm evals

Plugin-level eval suite. Two suites today, one runner each:

| Runner | Cases | Grades |
|---|---|---|
| `run.sh` | `cases-todo.jsonl` | The **TODO pair** gates in `arch:sub-todo.md` — where a block of content lives and what form it takes. |
| `run-names.sh` | `cases-searchable-names.jsonl` | The **descriptions** of the two naming skills — which one a task loads, and when neither does. |

Add a `cases-<skill>.jsonl` beside them when a third skill needs grading.

---

# Suite: naming-skill descriptions (`run-names.sh`)

## What it grades, and why a description is the thing under test

`searchable-names` and `pedant` split one subject between them. `searchable-names` picks the name
while the code is written; `pedant` attacks the names a finished diff already declares. A session
never reads either body until a description has already decided. So the description **is** the gate,
and the runner shows the judge nothing else — the two `description:` blocks, read live from
frontmatter, and the task. A description that needs its own body to be understood has failed here
before a human ever sees it.

One axis: **`pick`** → `searchable-names` | `pedant` | `none`.

`none` is not filler. Half the risk in a long trigger list is a description that fires on every code
task, and only a negative case can catch that.

## Run

```sh
./run-names.sh                 # all cases
./run-names.sh -i <case-id>    # one case
./run-names.sh -v              # also print the model's one-line rationale
MODEL=opus ./run-names.sh      # override the model (default: sonnet)
THRESHOLD=0.9 ./run-names.sh   # exit non-zero below this accuracy (default: 0.85)
```

Needs `claude` and `jq` on `PATH`. Exit 0 = accuracy ≥ threshold.

## Cases

`cases-searchable-names.jsonl`: `id`, `task` (what the user says, in their words), `pick` (the gold
label), `note` (why that label, and what the case guards).

20 cases: 10 `searchable-names`, 4 `pedant`, 6 `none`. Ten positives against four is deliberate —
`searchable-names` carries the long trigger list, so it is the one that can over-fire.

The cases that earn the suite:

- **`rename-what-review-flagged`** — the case the split exists for. A reviewer flagged `data`; now
  pick the real name and apply it. It *starts* in review, which points at `pedant`, but `pedant`
  proposes renames and applies none, and choosing the replacement is authoring work. If this one
  flips, the two descriptions have not drawn the line between them.
- **`commit-message`** and **`tighten-comment-prose`** — hard negatives at the two seams the move
  created. § Align language names commits, and the doc-line rule sits next to comment prose; neither
  belongs to a naming skill. `commit-message` owns the first, `comment-critic` § The sentence shape the
  second.
- **`switch-on-column-id`** — a column id is an identifier, so the description's "field name" clause
  can pull in a fact that belongs to `CODE_STYLE.md` § Declarative table vs imperative reader.
- **`metric-built-from-parts`**, **`log-prefix-shared`**, **`two-int-ids`**, **`helpers-file`** — four
  positives where the user never says the word "name". They read as instrumentation, a logging
  complaint, a bug report, and a routine file add. A description written only around "what should I
  call this" scores well without them and still misses most real cases.
- **`are-these-names-clear`** — the case that already earned its keep before the first run. The draft
  description listed `"is this name clear"` as a trigger, which is verbatim `pedant`'s job. Writing
  this case found the collision; the trigger came out.

## What this suite cannot see

It hands the model both descriptions and forces a choice, so it grades whether the two descriptions
**separate from each other**. It cannot grade whether either one **fires** — which is the failure the
skill was created to fix. `run-names-live.sh` measures that, and answers very differently. Read both
scores or neither.

## Last run

2026-08-31, `MODEL=sonnet`, skill-blind judge, 20 cases: **20/20**, accuracy 1.00.

`rename-what-review-flagged` held on the first run, with the rationale naming the seam itself:
"choosing and applying new name is authoring, not judging". Treat one clean run on a 20-case suite as
weak evidence — a perfect score also means no case is currently pulling on the descriptions. The next
real naming miss belongs here as a case before the description is edited to catch it.

---

# Suite: does the skill actually fire (`run-names-live.sh`)

Same 20 cases, same gold labels, opposite method. It starts a real `claude -p` session on the task
text alone — no framing, no mention of skills, all 182 installed skills competing — and reads the
transcript for a `Skill` tool call. Three sessions per case (`REPEATS`).

```sh
./run-names-live.sh          # all cases, 3 sessions each
REPEATS=1 ./run-names-live.sh -i what-should-i-call-it
```

**Positives pass on any hit; `none` cases pass only on every run.** Once is proof a trigger reaches.
"Quiet one time in three" is not restraint, and scoring it as a pass would hide a description that
over-fires two times in three.

## The preflight is not optional

The runner fires the bare word `pedant` before any case and exits 3 if no skill loads. Every gold
label except five claims something fired, and **a harness that cannot fire answers identically to a
description that never triggers.**

This is not theoretical. The first version of this runner passed
`--disallowedTools "Write,Edit,NotebookEdit,Bash"` for safety. That flag suppresses skill invocation
outright: `pedant` fires `wm:pedant` without it and fires nothing with it. The run scored every case
`none` and read exactly like a dead description. Safety now comes from the empty scratch cwd.

## Last run

2026-08-31, `MODEL=sonnet`, `REPEATS=3`, 60 sessions: **6/20, accuracy 0.30**. Below threshold.

| Skill | Fired |
|---|---|
| `searchable-names` | **0 of 33** attempts |
| `pedant` | 2 of 3 on its own bare word; **0 of 9** on every other naming-review task |

**Firing is non-deterministic.** `pedant-bare-word` went `none, pedant, pedant` on three identical
one-word prompts. In the previous single-run pass, the same prompt fired in the preflight and not in
the case, minutes apart. Never score this suite at `REPEATS=1`.

**`searchable-names` loses to a neighbour on its own ground.** `metric-built-from-parts` loaded
`name-from-the-registry` 3 times out of 3, and `align-terminology` loaded `terms` once. Both cover
naming, neither is in this plugin, and the description suite can never see them — it only ever offers
two choices.

**What the score means.** `pedant` is a mature, unmodified skill and it also fires 0 of 9 on
realistic prompts; it only wakes when the user types its name. So 0.30 is not a verdict on one
description — it is evidence that **a skill description is not a reliable delivery mechanism for a
standing convention.** The lever is a hook on the event where a name gets written, beside
`comment-check.mjs`, which already enforces the comment half of `CODE_STYLE.md` deterministically.

Keep this suite as the guard that stops anyone claiming the split works because the other one scores
1.00.

---

# Suite: the TODO pair (`run.sh`)

Gates under test — two axes, both applied to one block of candidate content:

- **`half`** → `human` | `agent` | `corpus` : which file the content belongs in.
  `human` is `TODO-N.md` (Outcome, New terms, Components, **Surface**, Autotest, Commit); `agent` is
  `TODO-N.agent.md` (Constraints — the pointer — Changes, Files, Pre-reads, Manual test, Definition
  of done); `corpus` is outside the pair: `thoughts/`, which holds a settled rule an increment can
  violate and the reason behind it alike.
  **Every diff is human** — `## Surface` is the one diff in the pair. **No rule and no origin link
  is ever in the pair** — a rule is the `description` of a `decision` note in `thoughts/`, printed
  by `~/.claude/scripts/wm-constraints.py`, and the reason behind it is the rest of that same note
  the `trace` skill searches for.
- **`form`** → `keep` | `reshape` : does it ship as written, or is it a **body** — content that *is*
  the implementation — that must be replaced by an Interface block plus a Behavior sketch, or by case
  sentences.

The runner extracts five rule blocks verbatim from the skill at run time (§ One ledger row, two
halves; § Surface, which nests the surface-not-a-body rule; § Changes; § Autotest; § Constraints),
so the eval always grades the current spec. Change a rule → re-run;
change a rule's *contract* (new label, new axis) → update `cases-todo.jsonl` in the same commit.

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

`cases-todo.jsonl`, one JSON object per line:

| Field | Graded | Meaning |
|---|---|---|
| `id` | — | slug naming the shape the case tests |
| `intent` | — | what the author says the block is, in their words — the framing the gate gets |
| `candidate` | — | the block itself, as it would land in the file |
| `half` | yes | gold label: `human` or `agent` |
| `form` | yes | gold label: `keep` or `reshape` |
| `note` | — | why that label, and what the case is guarding |

29 cases: 12 `human`/`keep`, 6 `agent`/`keep`, 3 `corpus`/`keep`, 7 `human`/`reshape`,
1 `agent`/`reshape`. The distribution leans human because the diff lives there now. No
`corpus`/`reshape` case exists yet — the `form` axis asks whether content is a **body**, and a
`decision` note — rule and reason in one — has no body shape to take.

**`sapiens-e2e-script` is the case this suite exists for.** It is real — a 45-line bash E2E check
pasted verbatim into a TODO's `## Changes` diff, which is what prompted the surface-not-a-body rule.
Every line of it is a choice the implementer makes at the keyboard (`stat -c%s` vs `stat -f%z`, the
`jq` filter, the `$REPO` paths, the literal `8`), and none is a choice a human approves at the gate.

The hard cases are the ones that *look* like the wrong label:

- `body-requested-marker` vs `go-function-body` — **the same function body, opposite labels.** The
  only difference is a `**Body requested:**` bullet recording that the human asked for it. That marker
  is the one thing making a body legal; its absence must not be excused. This pair guards both
  directions at once.
- `surface-compile-floor` — a Go interface with four methods, over no budget but shaped like a wall of
  code. Every line is a signature a caller sees, so it is surface, and the `**Compile floor:**` bullet
  is the sanctioned escape from the 150-line per-file cap.
- `do-bullet-prose` vs `do-bullet-with-code` — an increment's **Do** is prose naming the work and the
  call sites to migrate. The same increment with the implementation pasted into a fenced block is a
  body twice over: it belongs to no diff, and it duplicates what § Surface plus the Behavior sketch
  already carry.
- `enum-values-diff`, `config-defaults-diff` — blocks of literal values that *are* surface, because
  consumers branch on them.
- `sql-migration-body` — DDL is arguably schema surface, but the block also carries a backfill
  `DELETE`, so the candidate as offered is `reshape`.
- `autotest-go-test-source`, `autotest-expected-bytes-table` — right half, wrong form: Autotest is
  human-half, but test assertions and literal expected-value tables are bodies.
- `manual-test-steps` — literal `curl` and `make` lines that must be kept. A shell *script* is a body;
  a shell *command someone types* is not.
- `constraints-table` vs `constraints-pointer` — **the split that trips every author.** The rules
  themselves are `corpus`, one `decision` note each in `thoughts/`; the agent half keeps only the
  fixed line that prints them. A rule table under a TODO's `## Constraints` is the second copy that
  drifts.
- `constraints-table` vs `outcome-rationale` — **the counter-intuitive pair, in both directions.**
  A settled decision stated as a rule is a `thoughts/` note even though it reads like design; a
  reason for the Outcome is a `thoughts/` note even though it is *about* the human half. Both land
  in the same place now, so the `corpus` label turns on one question — is it outside the pair. What
  an increment can violate decides the note's *type*, `decision` over `fact`, not its home.

## Last run

Not re-run since the trace companion was dropped and the rules moved into `thoughts/`. The three `corpus`
cases and the `constraints-pointer` case have never been graded — run `./run.sh` before trusting the
score below, which was measured against an older contract.

### 2026-08-21 — the two-file contract

`MODEL=sonnet`, two axes, 26 cases, after the diff moved to `## Surface` in the human
half: **26/26 joint** (half 26/26, form 26/26), accuracy **1.00**.

Both new guard pairs held on the first run — `body-requested-marker` vs `go-function-body`, and
`do-bullet-prose` vs `do-bullet-with-code`.

`behavior-sketch-ts` was flaky under the previous contract (~2 of 3), the judge calling the canonical
sketch "real code, not pseudocode" over its `redis.get(...)`. It passed here. The likely reason is
that the sketch is no longer competing with per-increment diffs for the same slot: with no diff in the
agent half at all, a fenced block beside a **Do** bullet reads unambiguously as the sketch. Treat one
clean run as weak evidence — re-check it before assuming the flakiness is gone.

**Two failures so far were fixed in the rule, not the case** — which is the suite earning its keep,
since each was a real gap a reader would have hit:

- `manual-test-steps` (first run). § Changes gained "A command someone runs is not a body", drawing
  the line at whether the text becomes a file in the repo or gets typed at a prompt.
- `autotest-cases-sentences` (first run after `## Constraints` moved to the agent half — the judge
  read `## Autotest` as agent-half too). § Changes and § Constraints each declared their half in a
  leading note; § Autotest never did. It now says it is the human half's, and why: what the change
  *proves* is a design question the reviewer answers at the gate. 3/3 on re-check.

An earlier full run returned empty answers for a contiguous tail of cases (`got=` blank, 9/23). That
is the API dropping the back half of 23 serial `claude -p` calls, not gate movement — re-run before
reading a score with blank `got` columns.
