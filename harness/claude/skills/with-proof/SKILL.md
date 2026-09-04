---
name: with-proof
description: Settle a claim about how something behaves by running it — an instrument that could have said "no", a negative and a positive control, and a verdict of PROVED, DISPROVED, or INSTRUMENT BLIND. Use it whenever an answer is about to rest on unobserved behavior — recall, a source-read reasoned forward, a search that found nothing — and being wrong would be silent rather than loud.
argument-hint: [the hypothesis to prove]
---

# with-proof — the claim gets executed

A claim about behavior is proved by **an instrument that could have said "no"**. A run that would have looked identical had the claim been false proves nothing, however green it is. Everything below serves that one rule.

The situation arrives in four disguises, and naming yours picks the instrument in step 2.

| Disguise | It looks like |
|---|---|
| **Recall** | a config or frontmatter key, a CLI flag, an error string written from memory instead of read from whatever defines it |
| **Source-read reasoned forward** | what a dependency does to your data, which of several similarly-named entry points production takes, whether a binding or hook fires at all |
| **Nothing found** | an empty search, an absent process, code about to be deleted as dead |
| **Unrun edit** | an edit about to be reported as fixed |

## Flow

1. **Write the hypothesis and its kill criterion.** One falsifiable sentence — a specific input reaching a specific observable outcome — and beneath it the observation that would disprove it. No nameable kill criterion means this is a preference, and the work stops here.
2. **Choose the instrument, cheapest that can still see the claim.** Descend the ladder only while the rung above genuinely cannot observe the outcome; never trade sight for cheapness.
   | Rung | Instrument | Reach for it via |
   |---|---|---|
   | 1 | The real launch — app, CLI, server, the production path | `run` skill; `herdr` when it needs a tty |
   | 2 | A throwaway test in the project's own runner | `probe-library-behavior-with-a-throwaway-test` |
   | 3 | A standalone probe script in `~/.claude/scripts/` + its MANIFEST row | — |
   | 4 | Source-read, when nothing executable exists | verdict is labelled **source-read**, never proved |
3. **Build the input with the project's own producer.** A hand-written literal proves your idea of the input; the builder, fixture factory, or real command proves the input. `stage-fixtures-from-the-real-producer` covers the fixture case.
4. **Run it and capture the raw record** — the exact command, the exit code, the output lines you will quote. Long runs go to a background task (`bg-build-and-test`). Paraphrase from memory is not a record.
5. **Add both controls.** This is where a probe earns the word proof.
   - **Negative control** — break the exact thing the claim says was checked, re-run, and see it fail. Absent this, a PASS may only mean the instrument ran.
   - **Positive control** — every nothing-found result (no process, no grep hit, empty query, "no precedent") runs the same query against a neighbour known to exist, and finds it. A blind query answers exactly like a query about something gone.
6. **Rule with one of three verdicts.**
   - **PROVED** — outcome observed, negative control failed as designed.
   - **DISPROVED** — the kill criterion was observed.
   - **INSTRUMENT BLIND** — the run cannot distinguish the two: a control misbehaved, the path taken was not production's, or the claim's dimension was never inspected. Name the instrument that would see it, and stop reporting the result as evidence.
7. **Leave the tree as you found it.** Delete the throwaway, re-run the suite to its committed state, revert probe edits, and say in the report that you did. A probe worth keeping graduates to `~/.claude/scripts/<name>.sh` with its MANIFEST row.

## Report

```markdown
# Proof: <the hypothesis in one line>

**Kill criterion** — <the observation that would disprove it>
**Instrument** — <rung + what was run>

## Record
$ <command>            # exit <code>
<the output lines that matter>

## Controls
- Negative — broke <the exact thing>; result: <failed as designed | did not fail>
- Positive — same query against <known-present neighbour>; result: <found | blind>

## Verdict
**PROVED | DISPROVED | INSTRUMENT BLIND** — <one sentence on what the record shows>
<cleanup performed>
```

## Rules

1. **Executed and source-read speak in different voices.** Say which one a conclusion came from, every time. A source-read answer presented in an executed voice is the failure this skill exists to prevent.
2. **One hypothesis per proof.** A run that settles two claims at once settles neither cleanly — the negative control can only break one thing.
3. **A DISPROVED result is the win condition, not a setback.** Report it as promptly as a PROVED one, and hand the fix off as separate work.
4. **The record is quoted, not summarized.** Output the caller can paste is the whole point of running it.
