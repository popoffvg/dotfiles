---
name: prune-text
description: Rewrite a skill, an AGENTS.md/CLAUDE.md, or a doc corpus into the agent-writing house style — cut duplication across files, cut dead weight inside each file, then reshape into steps plus disclosed reference. Use when the user asks to prune, dedup, compress, or restyle docs or skills, or says files repeat the same information.
user-invocable: true
---

# Prune a doc corpus into the house style

The output is a document written for an agent to *run*, not for a human to read: a short spine of ordered steps, reference disclosed behind pointers, and every line earning its load. Three phases, in order — **dedup**, **cut**, **reshape**. Out of order you compress paragraphs phase 1 deletes whole, and you shape prose phase 2 removes.

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

One file at a time. **Split → lift → property test → paragraph test.**

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

**The paragraph test — delete the whole paragraph; what breaks?** One surviving property is not enough to keep its wrapper. Answer with the reader's next action, not the paragraph's topic:

| Cut class | Signal |
|---|---|
| **Framing** | It introduces, motivates, or summarizes its neighbours. The steps carry themselves. |
| **Restatement** | Another paragraph in this file already forces the same behavior. Cut the weaker. |
| **Wrong reader** | It answers a question this file's reader does not have — setup, history, an adjacent tool. Cut or move to the file that owns that reader. |
| **Sediment** | It describes behavior, a path, or a world that has changed. Verify against the code before believing it. |

Cutting beats shortening. A load-bearing property inside a failed paragraph moves into the nearest step as one clause; never keep the paragraph as its wrapper. Judge headers the same way — a header over one short paragraph is framing.

**What survives.** Three things read as filler and are not: the **counter-example** (a property stated with the failure it prevents — the failure is what makes it load-bearing), the **concrete anchor** (a calibration list carries its weight in the artifact each example names, `lefthook-no-root-placeholder` (`lefthook.yml`), not in the names), and **two load-bearing properties** (merging them into one sentence hides a rule — deletion with extra steps).

# Phase 3 — Reshape to the style

What survived is now arranged. Five moves, each on the whole file.

**Rank every piece on the hierarchy.** Three rungs, ordered by how immediately the agent needs the material: the **in-file step** (what it does, in order), the **in-file reference** (rules and definitions consulted on demand — a flat peer-set here is fine, not a smell), and the **disclosed reference** (a sibling file reached by a pointer, loaded only when the pointer fires). Branching decides the rung: inline what every branch needs, disclose what only some branches reach. Push too little and the top bloats; push too much and you hide what the agent needs. Where a skill is a procedure carrying heavy reference, mark the split in the text — steps under one heading first, reference after.

**Co-locate what stayed.** A concept's definition, its rules, and its caveats sit under one heading. Scattering fragments one meaning across the file; the test is whether it reads like documentation written for the agent.

**Give every step a completion criterion.** The condition that says the work is done, and it must be **checkable** (can the agent tell done from not-done?) and **demanding** ("every modified model accounted for" forces legwork that "produce a change list" does not). A vague bound invites the agent to finish early with the later steps pulling at it. Sharpen the wording first — split the sequence across a real context boundary only when the bound is irreducibly fuzzy and you have watched the rush happen.

**Collapse restatements into leading words.** A **leading word** is a compact concept already in the model's pretraining that the agent thinks with while running the file — *tight*, *red*, *fog of war*. Repeat it as a token, never as a sentence, and it anchors a whole region of behavior for a few tokens. Hunt the shapes that collapse: a triad spelled out at three sites ("fast, deterministic, low-overhead" → *tight*), a sentence gesturing at one idea ("a loop you believe in" → the loop goes *red*). A coined word recruits no priors and costs its own definition; reach for a pretrained one first. A word too weak to beat the default (*be thorough*) is a no-op — the fix is a stronger word (*relentless*), not more sentences.

**Turn every ban into its positive target.** A prohibition drags the forbidden behavior into context and makes it more available, and the negation is a weak modifier the named concept overruns — the ban half-reads as an instruction. State the behavior you want ("write one-line comments") so the banned one is never spoken. Keep a prohibition only as a hard guardrail with no positive phrasing, and pair it with the target.

**Rewrite the description last.** It is a **context pointer**: it names material the agent does not yet hold and encodes the condition for reaching it, and its wording — not its target — decides whether the skill fires. It does two jobs: say what the material is, and list the **branches** that trigger it. It costs on every turn, so it prunes harder than the body. Front-load the leading word. One trigger per branch — synonyms renaming a single branch are one branch written twice. Cut identity the body already carries.

Re-order by dependency once reshaping stops: a precondition must still precede its action.

# Verify

- **Run `~/.claude/scripts/prune-verify.sh <dir> [--base <ref>] [--ref <slug>] [--allow <name>]`.** It resolves every pointer, checks each collapsed file cites its shared reference once, and prints before/after line counts against a git ref. A dangling pointer is worse than the duplication it replaced, so `VERIFY FAIL` blocks the report. Pass `--ref` once per shared reference a Phase 1 collapse created. Pass `--allow` once per filename the corpus tells its reader to **create** rather than follow — a corpus documenting its own artifacts names `topic-map.md`, `cuts.md`, `props-<slug>.md`, and `GLOSSARY.md` without pointing at them.
- **Dispatch `prune-blind-reader`, one per pruned file, and answer every guess it reports.** Each guess is an over-cut: restore the cut line, or state why the guess is acceptable. Its Shape, Stopping, and Trigger answers grade the phase 3 reshape — a file it reads as the wrong shape, or a description it would not fire on, failed the reshape and goes back through it.
- Confirm `cuts.md` holds every cut with its class. A cut with no class is unreviewable.
- Report files touched with one line each, the script's line-count table, and the blind reader's surviving guesses.
- **When the file drives an automated decision — an eval, a gate, an agent — run that grader before and after.** Reasoning about "default" does not tell you which cuts were wrong. First measure the grader's own noise: repeat identical runs, and if they spread wider than one paragraph's effect, the grader cannot validate that cut. Restore the original text and report the cut as unmeasurable rather than claiming a cause you did not measure ([[dont-game-the-metric]] Failure 4).
