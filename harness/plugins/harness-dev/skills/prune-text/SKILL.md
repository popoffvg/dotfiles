---
name: prune-text
description: Rewrite a skill, an AGENTS.md/CLAUDE.md, or a doc corpus into the agent-writing house style — cut duplication across files, cut dead weight inside each file, then reshape into steps plus disclosed reference. Use when the user asks to prune, dedup, compress, or restyle docs or skills, or says files repeat the same information.
user-invocable: true
---

# Prune a doc corpus into the house style

The output is a document in the house style the `text-style` skill defines. Three phases, in order — **dedup**, **cut**, **reshape**. Out of order you compress paragraphs phase 1 deletes whole, and you shape prose phase 2 removes.

**The default verdict is cut.** A line survives by naming the reader action that breaks without it. "It is useful", "it adds context", "it reads well" are not survivals. Expect to remove a third of a mature file; a pass that cuts two paragraphs found nothing.

Every map is a file under `<scratchpad>/prune/`, never a message: `topic-map.md` (phase 1), `props-<slug>.md` (one per file), `cuts.md` (every cut with its class). A fan-out agent writes its own batch file and returns the path — returning the map refills the context the fan-out protected. The reply carries verdicts, never rows.

## Who does which stage

Mapping is reading; cutting is judgment. Split the run on that line and fan out every reading stage — three fan-outs and one script per prune run.

| Stage | Runs on | Why |
|---|---|---|
| Phase 1 map | `prune-mapper`, one per batch of files, always | Bounded read-and-report: named inputs, fixed table, no judgment. The threshold is one file, not eight — the common 3–6 file corpus is exactly where the main model wastes its context naming subjects. |
| Phase 2 split | `prune-mapper`, one per file, all in parallel | The same work per file. The main model then reads only the property columns and never loads the prose. |
| Both tests, and every edit | **The main model** | The no-op test asks whether *the model that will run this file* already behaves that way. A cheaper agent answers about its own defaults, which is the wrong reader. Judge at the tier that will run the pruned file. |
| After the cuts | `prune-blind-reader`, one per pruned file | It runs the pruned file cold, seeing no original and no cut list, and reports where it had to guess. Each guess is an over-cut. This is the only check that reads the file as a file instead of as a diff — and the only one your own memory of the original cannot bias. |
| Verify | `~/.claude/scripts/prune-verify.sh` | Pointer resolution and line counts are deterministic. A model there pays for what `grep` settles. |

Re-check any count a mapper reports before relaying it; one `grep -c` per headline number is enough.

# Phase 1 — Cross-file dedup

**Map → cross-reference → classify → rewire.** Classify before cutting: some duplication is load-bearing.

**Map.** For every file, one line per paragraph naming its *subject* (≤10 words), numbered per file, order preserved. Subjects collide across files; summaries do not. Dispatch `prune-mapper` in mode `topic`, one per batch, and concatenate the returned paths into `topic-map.md`.

```
### <path>
1. <topic>
2. <topic>
```

**Cross-reference.** Group topics appearing in 2+ files. Per group: the topic, the files+paragraphs carrying it, and the candidate **owner** — the file whose named job that topic is. Frontmatter and descriptions count as copies; include them.

**Classify.** Add a verdict to every group. Only one kind is debt:

| Kind | Signal | Verdict |
|---|---|---|
| **Required copy** | A hook syncs two copies verbatim; a table mirrored by convention; a worked example reused as illustration | **Keep.** Cutting fights the sync or removes a teaching instance. |
| **Restated rule** | The same rule ("commit after tests", "read-only") re-stated across sibling files | **Collapse** into one reference each file cites once. |
| **Re-derivation** | One file owns the spec; another re-teaches it inline | **Point.** Delete the copy, cite the owner. |

Check the repo for the signal before deciding: a pre-commit sync hook, a CLAUDE.md note that a copy is deliberate, a `*-help` command holding the second table. Those are required copies.

**Rewire.** Collapse → one shared `references/ref-<topic>.md`, each sibling left with `See ref-<topic>.md.` Point → delete the copy, cite the owner by relative slug. Where a file restates a rule **and** adds something unique, cut only the restatement and keep the delta. A pointer that re-summarizes its target is duplication with extra steps.

# Phase 2 — Cut inside the file

One file at a time. **Split → lift → property test → block test.**

**Split.** Every paragraph, list item, and table row becomes one row of `props-<slug>.md`:

| # | Idea (what it is for) | Property (the verb the reader must perform, or the constraint on how) |

Dispatch `prune-mapper` in mode `props`, one per file, all at once; it returns a path. Read the property column, never the prose. A row with no property is decoration — cut it now. A mapper that returns `INCOMPLETE` gets a second dispatch for the remaining paragraphs: a skipped paragraph is a paragraph you cannot judge.

**Lift the leading rule.** Read the property column alone and find the short phrase covering most rows — *verify before claiming*, *cite the file:line*, *one line per item*. State it once at the top; delete every paragraph whose property is that phrase in other words. Under 3 rows, there is no leading rule. Over 2–3 leading rules, the file holds more than one job: say so, split instead of prune.

**The property test — does this change the result, or is it the default here?** Keep only what a competent reader would get wrong without it, rewritten to its shortest forcing form. Cut everything else, and name the class:

| Cut class | Proof |
|---|---|
| **No-op** | The model already behaves this way. Untestable by argument — two readers disagreeing about a no-op disagree about the default, and settle it by running the file. |
| **Implied** | A surrounding step, the tool, or the file's own leading rule already forces it. |
| **Cache** | The environment owns it — `package.json`, the config, `--help`, the directory layout. A doc restating a cheap lookup only goes stale. Cache the unwritten convention and the gotcha no config confesses, never the one-command lookup. |

**The block test — delete the whole block; what breaks?** A block is a paragraph, a list, a table, or a section under one header. One surviving property is not enough to keep its wrapper, and a table nobody acts on or a list whose items all restate each other fails the same way one paragraph does. Answer with the reader's next action, not the block's topic:

| Cut class | Signal |
|---|---|
| **Framing** | It introduces, motivates, or summarizes its neighbours. The steps carry themselves. |
| **Restatement** | Another paragraph in this file already forces the same behavior. Cut the weaker. |
| **Wrong reader** | It answers a question this file's reader does not have — setup, history, an adjacent tool. Cut or move to the file that owns that reader. |
| **Sediment** | It describes behavior, a path, or a world that has changed. Verify against the code before believing it. |

Cutting beats shortening. A load-bearing property inside a failed paragraph moves into the nearest step as one clause; never keep the paragraph as its wrapper. Judge headers the same way — a header over one short paragraph is framing.

**What survives.** Three things read as filler and are not: the **counter-example** (a property stated with the failure it prevents — the failure is what makes it load-bearing), the **concrete anchor** (a calibration list carries its weight in the artifact each example names, `lefthook-no-root-placeholder` (`lefthook.yml`), not in the names), and **two load-bearing properties** (merging them into one sentence hides a rule — deletion with extra steps).

# Phase 3 — Reshape to the style

What survived is now arranged. Load the `text-style` skill and run its five moves over the whole file, then rewrite the description as its last move.

# Verify

- **Run `~/.claude/scripts/prune-verify.sh <dir> [--base <ref>] [--ref <slug>] [--allow <name>]`.** It resolves every pointer, checks each collapsed file cites its shared reference once, and prints before/after line counts against a git ref. A dangling pointer is worse than the duplication it replaced, so `VERIFY FAIL` blocks the report. Pass `--ref` once per shared reference a Phase 1 collapse created. Pass `--allow` once per filename the corpus tells its reader to **create** rather than follow — a corpus documenting its own artifacts names `topic-map.md`, `cuts.md`, `props-<slug>.md`, and `GLOSSARY.md` without pointing at them.
- **Dispatch `prune-blind-reader`, one per pruned file, and answer every guess it reports.** Each guess is an over-cut: restore the cut line, or state why the guess is acceptable. Its Shape, Stopping, and Trigger answers grade the phase 3 reshape — a file it reads as the wrong shape, or a description it would not fire on, failed the reshape and goes back through it.
- Confirm `cuts.md` holds every cut with its class. A cut with no class is unreviewable.
- Report files touched with one line each, the script's line-count table, and the blind reader's surviving guesses.
- **When the file drives an automated decision — an eval, a gate, an agent — run that grader before and after.** Reasoning about "default" does not tell you which cuts were wrong. First measure the grader's own noise: repeat identical runs, and if they spread wider than one paragraph's effect, the grader cannot validate that cut. Restore the original text and report the cut as unmeasurable rather than claiming a cause you did not measure.
