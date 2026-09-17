# spec — note format

Owner of the code skill's **thought**-note *format*. What a thought is — the concept and its rules — lives in the `thought` skill; this file specializes it into concrete files. Four types: `question`, `decision`, `fact`, `impl-decision`. A question is asked as a `question` note and answered by a new `decision` or `fact` note; the answered question is archived (§ Resolution). Notes link via `[[wikilinks]]`.

An **open question** is a thought too: it lives in `thoughts/` as `NNN-question-slug.md`, not as a checklist line in `spec.md`. `spec.md` has no Open Questions section (`ref-write.md` § Artifacts).

Shape of each note, filled, with the rules for every piece as `>` blocks (one per type):
- [`examples/note-question.md`](../examples/note-question.md)
- [`examples/note-decision.md`](../examples/note-decision.md)
- [`examples/note-fact.md`](../examples/note-fact.md)
- [`examples/note-impl-decision.md`](../examples/note-impl-decision.md)

## File naming

```
<notes-dir>/thoughts/
  NNN-type-slug.md
  archived/
    NNN-type-slug.md   # answered or superseded — kept for the trail, out of the live graph
```

- `NNN` — sequential 3-digit ID, zero-padded. Matches frontmatter `id`.
- `type` — `question`, `decision`, `fact`, or `impl-decision`.
- `slug` — kebab-case, ≤ 5 words, captures the topic.

Example: `001-decision-token-rotation.md`, `002-fact-token-ttl.md`, `004-question-refresh-scope.md`.

## Frontmatter

```yaml
---
type: question | decision | fact | impl-decision
id: "NNN"
status: proposed | open | approved | declined   # open only on a question; proposed only on a decision; approved is the default otherwise
description: >                       # 1–3 sentences — what this thought settles. Required on every type
  <the summary the index prints>
date: 2026-06-18T14:30:22
source: auto | human                  # optional
todo: TODO-N                          # type: impl-decision only — the row the rule is scoped to
tags: [topic, subtopic]
---
```

- `type` — drives the section structure below.
- `id` — matches the `NNN` prefix in the filename. Never changes, and no `NNN` is ever reused — not even by the note that answers or supersedes this one.
- `description` — **required on every note, every type.** 1–3 sentences summarizing what this thought
  settles, written to be read *instead of* the body: it is the only text the index shows (§ Finding
  the thought for your task), and a reader picks which notes to open from it alone. State the answer,
  not the topic — "Rotated tokens copy the scope of the token they replace" is a description; "how
  scope works on rotation" is a filename. Never a paraphrase of the title: the title names the
  thought, the description says what it decided or established and, when it fits, why. A note whose
  description could stand for two different answers is unfindable — the reader opens every note again.
  **On a `decision` or an `impl-decision` it is also the rule text the implementer obeys** —
  `wm-constraints.py` copies it verbatim into the constraint set (§ Finding the thought for your
  task), so write it as a rule code can obey: what the code must do, stated in the imperative or as
  the invariant it holds. There is no second copy of the rule anywhere, so writing a good rule *is*
  writing this description. What the generated set looks like: `ref-todo-sections.md` § Constraints.
- `status` — the lifecycle of the thought. It moves in one direction — `proposed → approved → declined` on a decision, `open → approved | declined` on a question — and these four values are the whole set.
  - `proposed` — on a `decision` or an `impl-decision` only: the choice is drafted, nobody has agreed to it yet. It **carries no rule** — `wm-constraints.py` generates the constraint set from `approved` notes alone — and it **blocks spec readiness** the same way an open question does. Write one when a choice is still being argued, so the draft outlives the session instead of staying in chat.
  - `open` — on a `question` only, and the only value that keeps a question in the live graph.
  - `approved` — an answered question, and any decision, fact, or impl-decision that has been agreed. It is the default when the key is absent on a non-question, and it is the value that turns a decision's `description` into a rule the implementer obeys.
  - `declined` — the thought is rejected, moot, or superseded, instead of deleted.

  **Any other value fails `spec-lint.py`.** A status the tools do not know does not raise an error on its own — it silently drops the note out of the constraint set, which is a rule nobody can see is missing. The allowlist is what makes that loud.
- `date` — ISO 8601, the moment the note was written. On a question, add `resolved:` with the timestamp of the answer when marking it (§ Resolution).
- `source` — optional, on every type. `human` when the user stated or chose it; `auto` when nobody was asked — the answer came out of a research doc or out of the code. On a `question` it says where the question surfaced; on the `decision` or `fact` that answers it, where the **answer** came from.
- `source: auto` on a decision marks an **auto-discovered** choice — the research or the code answered it, nobody was asked. The choice is as binding as any other, but it carries no human approval, so a reviewer reads those rows first. Every `auto` decision names what forced it in its `## Why` — the `path:line` in the code, or the research doc.
- `todo` — on an `impl-decision` only, and required there: the ledger row whose implementation raised the decision. It is what scopes the rule: `wm-constraints.py --todo TODO-N` prints every corpus-wide rule plus the `impl-decision` rules carrying that row, so a rule written without the key reaches every TODO and a rule carrying the wrong row reaches none. A `decision` or a `fact` never carries it — a rule that holds for one row only is an `impl-decision` by definition.
- `tags` — 1–3 topic tags for grouping in Obsidian graph view.

## Finding the thought for your task

**Read the metadata first, then read only the notes it points at.** The graph grows past the point
where reading every note is affordable, and an agent that opens all of them arrives with the wrong
ones in context. The index is the entry:

```bash
~/.claude/scripts/wm-thought-index.py <notes-dir>/thoughts            # every live note: id, type, status, tags, title, description, path
~/.claude/scripts/wm-thought-index.py <notes-dir>/thoughts -m 'token|scope'   # only the notes whose metadata mentions it
~/.claude/scripts/wm-thought-index.py <notes-dir>/thoughts -t decision --files # paths only, for a batch read
~/.claude/scripts/wm-thought-index.py <notes-dir>/thoughts --todo TODO-2       # the impl-decision notes of one TODO
~/.claude/scripts/wm-constraints.py <notes-dir>/thoughts                      # the rules alone, no note opened
```

The rule, in order:

1. Run the index (`-m <regex>` over the terms your task names — the match runs across id, type,
   tags, title, **and** description).
2. Read the descriptions and pick the notes that bear on the task. A description that does not bear
   on it is the answer "do not open this note".
3. Open only those, in full, then follow their `Depends on` / `Affects` wikilinks — the links are
   walked from a note you chose, never from the whole directory.

`--archived` reaches into `thoughts/archived/`; leave it off unless you are auditing history.
`--missing-description` lists the notes that break the § Frontmatter rule, so an author finds them
before the reader does.

**Obeying the corpus is a different read from searching it.** `wm-constraints.py` prints the rules
alone — everything an implementer needs without opening a note. Which notes it draws a row from is
`ref-todo-sections.md` § Constraints. `--check` reports a note that qualifies as a rule and carries
no description: the § Frontmatter rule, counted.

---

## Question note

The answer is not known yet — the question blocks the spec. Sections, rules, worked example: [`examples/note-question.md`](../examples/note-question.md).

Write one the moment a question surfaces (seeded from the request, raised by a research gap, or opened mid-grill). It is the only thought type that carries `status: open`, and the only one a READY spec must not contain.

### Resolution — answer in a new note, archive the question

**A question is a live thought only while it is open.** The answer is a *different* thought: it is
written as its own note, and the question note leaves the live graph. Never edit a question note
into its own answer. Three steps, in this order:

1. Write the answer as a new note at the next counter (`NNN`+1) — `NNN-decision-slug.md` when the
   answer is a choice, `NNN-fact-slug.md` when it establishes a truth. Keep the question's `slug`;
   the `NNN` is a fresh one. Set `source` to what resolved it (`auto` when the answer was
   read out of the code or a research doc, `human` when the user answered) and `date` to now.
   Body per that type's example (`examples/note-decision.md` / `examples/note-fact.md`), and **restate the question's `## Question`
   text verbatim** — that is the audit trail of what was asked, and it is why no live note ever has
   to reach back into `archived/`.
2. In the question note, set `status: approved` (it was answered), add `superseded_by: "<new NNN>"`,
   and put `Answered by [[NNN-type-slug]]` as the first body line under the title. Keep the rest of
   the body untouched — the question as asked is the trail.
3. **The move to `thoughts/archived/` is automatic — never `mv` the file yourself.** The
   `thoughts-archive.sh` PostToolUse hook archives every question note whose `status` is no longer
   `open`, filename and `NNN` unchanged, and neither is ever reused. Dropping out of `thoughts/` is
   also what clears the question from the readiness gate — `wm-open-questions.sh` scans at
   `-maxdepth 1`.

Then re-link (§ Back-linking): repoint every `[[NNN-question-slug]]` wikilink in a live note at the
answer note. A live note must not depend on an archived one; the hook lists the files still pointing
at the question it just archived, and that list is the re-link worklist.

`superseded_by` is the one key for "the live note that replaced this one", whatever the reason — a
question answered, or a decision reversed (§ Superseding). Only the body verb differs: *Answered by*
a question's answer, *Superseded by* a reversal.

**One open question per topic.** Two notes asking the same thing is the thing to avoid — not two
notes on the topic, since the answer is always a second note.

A question that turns out to be moot has no answer note: keep it a `question`, set
`status: declined`, and give the one-line reason in the body. The hook archives it the same way —
`declined` is not `open`, so it is no longer live. Only `open` blocks readiness.

## Superseding — move to `thoughts/archived/`

A reversed thought is superseded, never deleted, and never left in the live graph. Two steps,
in this order:

1. Write the replacement note at the next counter (`NNN`+1), matching example.
2. In the old note, set frontmatter `status: declined`, add `superseded_by: "<new NNN>"`, and put
   `Superseded by [[NNN-type-slug]]` as the first body line under the title.

**The move to `thoughts/archived/` is automatic — never `mv` the file yourself.** The
`thoughts-archive.sh` PostToolUse hook sweeps the live notes after every `Edit`, `Write`, and
`Bash` call and moves out every note carrying a non-empty `superseded_by:`, filename unchanged;
the `NNN` counter is never reused. On a `decision`, `fact`, or `impl-decision`, `superseded_by` is
the whole marker — `status: declined` alone leaves the note live. (A `question` is the exception:
any status but `open` archives it, with or without a replacement — § Resolution.) The hook prints
what it moved, and names any of step 2 you left undone.

Then re-link (§ Back-linking): repoint every `[[old-note]]` wikilink in a live note at the
replacement. A live note must not depend on an archived one — that is a dangling dependency, and
it fails the back-linking check. The hook lists the live files still pointing at the note it just
archived; that list is the re-link worklist.

Why a folder and not a flag: the live graph is what the reader and the audit walk. An archived
note stays readable and stays in the jj history, but stops competing with the thought that
replaced it. `wm-open-questions.sh` scans `thoughts/` at `-maxdepth 1`, so an archived note never
blocks the gate.

Archived notes are read only when auditing history — `jj -R <notes-dir> log` shows when each one
was replaced.

## Decision note

The answer IS a choice. Sections, rules, worked example: [`examples/note-decision.md`](../examples/note-decision.md).

## Fact note

The answer establishes a truth. Sections, rules, worked example: [`examples/note-fact.md`](../examples/note-fact.md).

## Implementation decision note

An implementation choice made while authoring a TODO body. Same directory, shared counter. Sections, rules, when-to-write table: [`examples/note-impl-decision.md`](../examples/note-impl-decision.md).

## What a choice costs — the optional `## Consequences`

Both decision types carry an optional `## Consequences` section, and only those two: a fact makes no
choice and a question holds no answer, so neither has a bill to state.

Write it when the choice makes something harder downstream in a way the Resolution does not already
say — a caller that now needs a second error type, a client that must handle a new status code, a
migration the next TODO inherits. One bullet each. Leave it out when there is nothing surprising;
a section listing the obvious is how the one that matters gets skipped.

It is the forward half of the reasoning the note already carries backwards: `## Why` (or
`## Alternatives`) says what the choice beat, `## Consequences` says what it will cost.

---

## Back-linking

At loop end (any subcommand that writes or edits thoughts): for each `Depends on` from note B → note A, add `Affects` in A → B. Populate each note's `links` frontmatter with every `[[wikilink]]` in its body. Verify every target file exists in `thoughts/`.

## Open work lives in the same graph

Every `status: open` question note is an unresolved blocker, and the graph is where they are
counted. List them with `~/.claude/scripts/wm-open-questions.sh <notes-dir>/thoughts` — exit 1
means at least one is open, which is the hard block on spec readiness.

A `status: proposed` decision blocks the same gate for the same reason: the spec would enter `impl`
carrying a choice nobody agreed to, and the implementer would never see it — a proposed note
generates no rule. Bring each one to `approved` or `declined` before implementation starts. Both
blocks are enforced by `guard.sh` on the flip to `status: impl`, and reported by `spec-lint.py`.
