# review — the report files

> Two filled artifacts, both under `<notes-dir>/review/<target>/`: one gate's own file, and the
> merged `report.md` the caller writes over the whole roster. Copy the one you are writing, replace
> the content, delete the `>` lines — each one states the rules for the piece above it.
> The roster behind both — which gate judges what, the order, the FAIL routing, the budget, and the
> rule that a green gate still writes its file — is `ref-gates.md`. Each gate's own `## Covered` rows
> live in its agent file, because an agent is a separate prompt that never reads this one.

## One gate's file — `<notes-dir>/review/TODO-3/rules.md`

```
---
reviewed: 2026-09-04T11:07:52+02:00
---

[RULES] Result: FAIL

## Judged
- 36 rules, 2 files, 9 batches — 3 FAIL raised, 1 dropped

## Covered
| Rule | Verdict |
|---|---|
| Coverage — every planned pair has a verdict | clean |
| comments/a-comment-repeats-the-code-under-it | 1 nit |
| names/one-concept-has-two-names-in-the-diff-or-one-name-has-two-co | 1 failure |
| go/a-plain-getter-returns-a-non-pointer-field | n/a — no changed file in scope |

## Failures
- writer/column.py:34 — names/one-concept-has-two-names-in-the-diff-or-one-name-has-two-co — `rid` reads as a row id in a writer that also writes rows — rename it to `run_id`

## Dropped
- writer/column.py:12 — tables/a-branch-keys-on-one-item-s-identity — the branch tests a type, not one item's id
```

> **The path comes from the brief, never from the gate.** The caller's `report:` line names it; the
> gate writes the same text there that it returns, and the frontmatter belongs to the file alone —
> the returned text starts at the `Result:` line.
>
> `reviewed:` is what `date -Iseconds` printed, in a frontmatter block above everything else. It is
> what tells a reader whether this file is the round that just ran.
>
> **`## Covered` carries one row per rule that gate owns, and the rows are fixed** — the same list
> every run, whatever the diff holds. The Verdict column takes `clean`, `<n> failure(s)`,
> `<n> nit(s)`, or `n/a — <the reason nothing in this diff reaches the rule>`. A row with nothing to
> say is `n/a`, never a dropped row: an empty Failures section under a full table says the diff is
> clean, under a short one it says nothing.
>
> **The rows above are the rules gate's: one per rule in `manifest.json`, shortened here.** Take the
> rows for the gate you are writing from its agent file — `wm:agents/rule-reducer.md`,
> `wm:agents/idiom-critic.md`, `wm:agents/reuse-critic.md`, `wm:agents/lint-tester.md`, `wm:agents/correctness-critic.md` — and
> never from this example. A gate whose verdict needs a third column adds it there too: `lint-tester` carries
> `| Rule | Command | Verdict |`, because the command it ran is the evidence for its row.
>
> **A Failure line ends in the edit that closes it.** The finding's own middle fields are the gate's
> — `rules` gives the rule id and why the lines break it, `correctness` the input and the wrong result. `## Nits` follows the same shape and is omitted when the gate raised none.

## The merged report — `<notes-dir>/review/TODO-3/report.md`

```
---
reviewed: 2026-09-04T11:09:18+02:00
---

[GATE] Result: FAIL   (after 2 rounds)

## Gates
- lint PASS · rules FAIL · idiom PASS · reuse PASS · correctness PASS · mutation PASS · test PASS

## Failures
- rules · writer/column.py:34 — `rid` reads as a row id in a writer that also writes rows — rename it to `run_id`

## Nits
- rules · writer/column.py:41 — comments/a-comment-sentence-is-hard-to-read-once — lead with `a null run id`
```

> **The caller merges; a gate reports only itself.** Every mode writes this same file and returns the
> same text, so a reader opens one path whatever ran.
>
> `Result:` is `PASS | FAIL` plus the rounds the chain spent — the number a human needs to tell a
> first-pass green from one that took two fixups.
>
> **`## Gates` names every gate in the roster on one line**, in roster order, each with its own
> verdict. A gate missing from the line is a gate whose file nobody read.
>
> **A gate that returned nits alone is `PASS`.** Nits never block, so they change no verdict — the
> nit above still reaches the human.
>
> **Every finding keeps the gate that produced it**, as the first field. A finding whose gate is
> stripped cannot be re-litigated: the reader needs to know whether a line was rejected by a table or
> by a judgment.
>
> `## Failures` is omitted when the result is PASS; `## Nits` is omitted when no gate raised one.
> Each Failure line reads `<gate> · <file:line> — <the scenario or the rule> — <the edit that closes
> it>`, and all three fields are filled: a Failure with no edit is a finding the implementer cannot
> act on.
