# wm evals

Plugin-level eval suite. Today it grades one thing: the **TODO pair** gates in
`../skills/arch/commands/sub-todo.md`. Add a `cases-<skill>.jsonl` beside `cases-todo.jsonl` when a
second skill needs grading.

Gates under test — two axes, both applied to one block of candidate content:

- **`half`** → `human` | `agent` | `trace` : which of the row's three files the content belongs in.
  `human` is `TODO-N.md` (Outcome, New terms, Components, **Surface**, Autotest, Commit); `agent` is
  `TODO-N.agent.md` (Constraints, Changes, Files, Pre-reads, Manual test, Definition of done);
  `trace` is `TODO-N.trace.md` (Trace — where each decision came from).
  **Every diff is human** — `## Surface` is the one diff in the pair, and neither companion carries
  one. **Every origin link is trace** — a `[[note]]` or a dated document cited as the reason for
  something in the pair belongs there and nowhere else.
- **`form`** → `keep` | `reshape` : does it ship as written, or is it a **body** — content that *is*
  the implementation — that must be replaced by an Interface block plus a Behavior sketch, or by case
  sentences.

The runner extracts five rule blocks verbatim from the skill at run time (§ One ledger row, two
halves and a trace; § Surface, which nests the surface-not-a-body rule; § Changes; § Autotest;
§ Trace), so the eval always grades the current spec. Change a rule → re-run;
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

29 cases: 12 `human`/`keep`, 6 `agent`/`keep`, 3 `trace`/`keep`, 7 `human`/`reshape`,
1 `agent`/`reshape`. The distribution leans human because the diff lives there now. No
`trace`/`reshape` case exists yet — the `form` axis asks whether content is a **body**, and a trace
row is an anchor plus a citation, which has no body shape to take.

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
- `constraints-table` — the one section whose half is counter-intuitive. It reads like design, so it
  looks human-half, but a constraint is a decision *an increment can violate*, so it lives beside the
  increments in the agent half. It carries the rule and a `C<n>` id alone; the origin that used to
  sit in its `From` column is now a trace row.
- `constraints-table` vs `trace-outcome-rationale` — **the counter-intuitive pair, in both
  directions.** A settled decision stated as a rule is agent-half even though it reads like design;
  a reason for the Outcome is trace even though it is *about* the human half. What decides it is
  whether an increment can violate the line, not which section it discusses.

## Last run

Not re-run since the trace companion landed. The three `trace` cases and the reshaped
`constraints-table` candidate have never been graded — run `./run.sh` before trusting the score
below, which was measured against the two-file contract.

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
