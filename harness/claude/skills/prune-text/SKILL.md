---
name: prune-text
description: This skill should be used when the user asks to "prune the docs", "dedup the corpus", "compress this file", "remove duplicate/redundant paragraphs", "cut the filler", "reduce duplication across files", "these files repeat the same information", "consolidate repeated content", or wants to shrink a set of text files (plain prose, markdown, SKILL.md, references, commands, specs) without losing signal.
user-invocable: true
---

# Prune a doc corpus

Two phases, in order:

1. **Cross-file dedup** — remove text that repeats across files.
2. **Per-file prune** — for each file that remains, compress what is left.

Run phase 1 to the end before starting phase 2. Pruning a file first wastes work on paragraphs that phase 1 would delete anyway.

# Artifacts — every map goes to a file

Both phases produce a map before they cut anything. Write each map to a file under `<scratchpad>/prune/`; never emit one into the reply.

| Artifact | Written by | Content |
|---|---|---|
| `topic-map.md` | phase 1 step 1 | one line per paragraph, per file |
| `cross-ref.md` | phase 1 steps 2–3 | the shared-topic groups, their owner, their classification |
| `props-<slug>.md` | phase 2 steps 1–3 | the idea/property table for one file, one artifact per pruned file |
| `cuts.md` | both phases | every cut with its verdict reason — the Verify list |

Three reasons the map is a file and not a message:

- A fan-out agent writes its own batch file and returns the path. Returning the map itself puts the whole corpus back in the context the fan-out existed to protect.
- The map outlives the edit. When a cut turns out wrong, the artifact says what the paragraph was judged to be; a map that scrolled past in chat does not.
- The map is longer than the prose it describes. A 200-line file maps to 60 rows; pasting those rows costs more than reading the file twice.

Read an artifact back when you need it. Do not restate its rows in the reply — the reply carries the verdicts and the cut list, not the map.

# Phase 1 — Cross-file dedup

Four steps: map → cross-reference → classify → rewire. Never cut before classifying — some duplication is load-bearing. Markdown-specific signals (frontmatter, sync hooks) apply only when present.

## Step 1 — Topic map

For every file, walk top to bottom and write ONE line per paragraph naming its subject (≤10 words) into `topic-map.md`, preserving order and numbering paragraphs per file:

```
### <path>
1. <topic>
2. <topic>
```

Name the *subject*, not a summary — subjects are what collide across files. For a large corpus (>~8 files), fan out parallel read-only agents, each mapping a batch. **Each agent writes its own `topic-map-<n>.md` and returns only that path** — an agent that returns the map itself refills the context the fan-out existed to protect. Concatenate the batch files into `topic-map.md` when they land.

## Step 2 — Cross-reference

Read `topic-map.md` and group topics appearing in 2+ files. Write a table per group into `cross-ref.md`: the topic, the files+paragraphs that carry it, and a candidate **owner** (the file whose job that topic is). Include the file's own frontmatter/description if it restates a listed topic.

## Step 3 — Classify each group (do NOT skip)

Add a verdict column to every group in `cross-ref.md`. Three kinds — only one is debt to cut:

| Kind | Signal | Verdict |
|---|---|---|
| **Required copy** | A hook/tool keeps two copies verbatim in sync; a table mirrored by convention; a worked example reused as illustration | **Keep.** Cutting it fights the sync mechanism or removes a teaching instance. |
| **Cross-cutting rule restated per file** | The same rule ("commit after tests", "log to X", "read-only") re-stated in many sibling files | **Collapse** into one shared reference; each file cites it once. |
| **Owner + re-derivation** | One file owns the spec; another re-teaches it inline instead of pointing | **Point.** Delete the inline copy, cite the owner. |

Check the repo for signals before deciding: a pre-commit sync hook, a CLAUDE.md note that a copy is deliberate, a `*-help` command holding a second table copy. Those mark **required copies** — leave them.

## Step 4 — Rewire

- **Collapse:** create one shared reference (e.g. `references/ref-<topic>-rules.md`); each sibling drops the restatement and leaves ONE line: `See ref-<topic>-rules.md.`
- **Point:** delete the inline copy; cite the owner by its relative slug.
- **Preserve the delta:** when a file both restates a rule AND adds something unique, cut only the restatement — keep the unique part, then cite the owner for the rest.
- **Owner picks itself:** the file whose named responsibility is that topic. Others reference it, never the reverse.

## Phase 1 rules

- **Classify before cutting.** The first instinct — "same words twice, delete one" — destroys required copies and worked examples.
- **A worked example is not duplication.** The same scenario shown as a flow, a decision note, and a test is deliberate; each shows a different facet.
- **Frontmatter descriptions count** as a copy of the topic list — include them in the map, but they're usually required (they drive routing/triggering).
- **One-line pointers, not paragraphs.** A pointer that re-summarizes the owner is just duplication with extra steps.

# Phase 2 — Per-file prune

Run on one file at a time, after phase 1. Four steps: split → generalize → attack properties → attack paragraphs.

## Step 1 — Split every paragraph into idea + property

Walk the file top to bottom. For every paragraph, list item, and table row, write one row into `props-<slug>.md`, where `<slug>` names the file being pruned:

| # | Idea (what it does) | Property (how it must be done) |
|---|---|---|
| 1 | one sentence | the action, constraint, or condition it prescribes |

- **Idea** — one sentence, what the paragraph is for. Not a quote, not a summary of the wording.
- **Property** — the operative part: the verb the reader must perform, or the constraint on how. Strip the prose around it.
- A paragraph with an idea but no property is decoration. Mark it `—` and cut it in step 3.
- A paragraph carrying two properties gets two rows. Do not merge them yet.

Cover the whole file. A skipped paragraph is a paragraph you cannot judge.

## Step 2 — Generalize the properties

Read the property column alone. Find one leading phrase — a few words — that covers most rows. Examples of the shape: "verify before claiming", "cite the file:line", "delegate to a subagent", "one line per item".

- State that phrase ONCE, at the top of the file, as a rule.
- Every row whose property is just that phrase in other words: delete the paragraph. The leading rule now carries it.
- If no phrase covers ≥3 rows, there is no leading rule. Skip to step 3 and keep every row.
- More than 2–3 leading rules means the file holds more than one job. Say so; splitting the file beats pruning it.

## Step 3 — Attack the properties

Every property the leading rule did not absorb gets one question:

**Does this property change the result, or is it already the default in this context?**

| Verdict | Test | Action |
|---|---|---|
| **Load-bearing** | Drop it and a competent reader does the wrong thing | Keep. Rewrite to the shortest form that still forces the behavior. |
| **Default** | Drop it and a competent reader still does the same thing | Cut. |

"Default" means: the surrounding steps already imply it, the tool enforces it, or it is standard practice for the reader named in the file. Name which of the three when you cut — an unproven "obvious" is a guess.

Cut every row marked `—` in step 1.

## Step 4 — Attack the paragraph itself

Step 3 keeps a paragraph as soon as one property survives. That is not enough. Ask of every surviving paragraph:

**Delete the whole paragraph — what breaks?**

Answer with the reader's next action, not with the paragraph's topic. "The reader would not know X" only counts if the reader has to *do* something with X.

| Verdict | Test | Action |
|---|---|---|
| **Earns its place** | Some step in the file becomes wrong or impossible without it | Keep. |
| **Framing** | It only introduces, motivates, or summarizes the paragraphs around it | Cut. The steps carry themselves. |
| **Restated in-file** | Another paragraph in the same file already forces the same behavior | Cut the weaker one. Phase 1 catches this across files, not inside one. |
| **Wrong reader** | It answers a question this file's reader does not have (setup, history, an adjacent tool) | Cut, or move it to the file that owns that reader. |

Cutting the paragraph beats shortening it. A load-bearing property inside a paragraph that fails all four tests moves into the nearest step as one clause — do not keep the paragraph as a wrapper for it.

Check the section headers the same way. A header over one short paragraph is usually framing; fold the paragraph into the section above it.

## Phase 2 rules

- **Judge the property, not the prose.** A well-written paragraph whose property is a default still goes.
- **Do not merge two load-bearing properties into one sentence.** Compression that hides a rule is deletion with extra steps.
- **Keep the counter-example.** A property stated with the failure it prevents survives; the failure is what makes it load-bearing.
- **Order by dependency after cutting.** Removed paragraphs leave gaps — the precondition must still come before the action.
- **Keep the concrete anchor in a calibration list.** A list of named examples carries its weight in the artifact each one points at (`lefthook-no-root-placeholder` (`lefthook.yml`)), not in the names. Strip the parentheticals and the list stops calibrating.

# Verify

- Grep every `see <slug>` / `See <file>` pointer and confirm each resolves to an existing file. A dangling pointer is worse than the duplication it replaced.
- Confirm each collapsed file cites the shared reference exactly once.
- Confirm `cuts.md` holds every property cut in phase 2 step 3 and every paragraph cut in step 4, each with its verdict reason. A cut with no reason is an unreviewable cut. The reply names the artifact and summarizes the verdicts; it does not paste the rows.
- Report files touched with a one-line change each, before/after line counts, and paste the grep proving no dangling pointers.
- **When the pruned file drives an automated decision — an eval, a gate, an agent's behavior — run that grader before and after.** Reasoning about "default" does not tell you which cuts were wrong. But check the grader's own noise band first ([[dont-game-the-metric]] Failure 4): if repeated identical runs spread wider than one paragraph's effect, the grader cannot validate that cut — keep the original text and say the cut is unmeasurable, rather than reporting a cause you did not measure.
