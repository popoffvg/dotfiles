# Curriculum design

Detailed guidance for Step 2 and Step 3 of the `lessons` skill.

## Lesson anatomy

A lesson is not a glossary section. Give each one this shape:

1. **A claim** — one sentence stating what this lesson establishes. Not a topic label ("Structure"), a claim ("The block consumes structure and confidence, and computes everything else itself").
2. **The terms it introduces** — as definition blocks, each with the operational consequence attached (see below).
3. **At most one callout** — a trap, a mental model, or a caution. More than one per lesson dilutes all of them.
4. **A forward hook where useful** — "this collides with Lesson 12" earns its place when the collision is the point.

Target 150–400 words of prose per lesson plus its term blocks. A lesson that runs longer is usually two lessons whose dependency order was not resolved.

## Term blocks: definition + consequence

Every term gets two parts. The definition comes from the corpus; the consequence is derived by asking "what does knowing this let the reader do or predict?"

```
Structural tolerance
  DEFINITION  How readily the fold accepts a substitution at a position.
  CONSEQUENCE High ⇒ comparatively safe to change. Low ⇒ tightly constrained,
              risky. And: distinguish it from confidence (model certainty) and
              exposure (geometry) — three per-residue numbers, three jobs.
```

The "and:" clause is where most teaching happens. Terms that are easily confused with each other should be **contrasted explicitly in both directions**, not defined independently and left to the reader.

## Content types, in priority order

When space is limited, cut in reverse order of this list.

| Type | Why it earns space | Example shape |
|---|---|---|
| **Trap** | Marks where the authors expected failure | "Tempting: X. Wrong, because Y." |
| **Asymmetry** | Where real understanding lives | "Mean for A, worst for B — optimism averaged, risk not." |
| **Rejected alternative** | Teaches the governing constraint | "The branch died because cost X vanished, not because of biology." |
| **Consequence** | Makes a definition actionable | "1–3 residue motif ⇒ two shots at a fix." |
| **Definition** | Necessary, insufficient | Glossary content |
| **Enumeration** | Reference material; keep as a table | Column lists, tool lists, license tables |

Push enumerations into tables with their own `overflow-x: auto` container. Prose should not narrate a list the reader can scan.

## Sequencing patterns

**The problem-first opener.** Lesson 1 states what goes wrong in the world, then names the phrases the rest of the course unpacks. Never open with a definition list — the reader has no reason to hold any of it yet.

**Objects before addresses.** Introduce the things (domains, records, entities) before the schemes used to index them. Numbering and keying schemes are unintelligible without the thing they number, and are usually a lesson of their own — they are a real design problem, not a formality.

**Mechanism before policy.** Teach the core mechanism (the model, the algorithm, the protocol) before the decision logic layered on top (triage rules, gates, bands, thresholds). Policy is only comprehensible once the reader knows what it is constraining.

**Contracts near the end.** Output formats, column contracts, and CSV/schema tables are the last technical lesson. They compress every prior concept into field names, so they land only after those concepts exist.

**Boundaries last.** Out-of-scope lists, deferred work, and phasing close the course. Each exclusion should carry its reason — "deferred because no dataset exists" teaches something different from "deferred because it needs the other thing first".

**Platform/infrastructure vocabulary is its own lesson**, placed late. Terms like the host platform's unit of composition, its data-frame type, its asset packaging — these are ambient for insiders and opaque for newcomers, and they do not belong sprinkled through domain lessons.

## Numbering

Number lessons only when the sequence is real — when lesson N genuinely depends on N−1. In a dependency-ordered course it is real, so number them, and use the numbers in a sticky syllabus rail so the reader can see the arc and their position in it.

Do not number pipeline steps and lessons with the same visual device; the reader will conflate two different sequences. Give the pipeline its own treatment.

## Worked arc

From a real spec corpus (an antibody variant-design block), the 16-lesson arc that resulted:

1. The one-sentence problem — what goes wrong, and the two phrases the course will unpack
2. Domain anatomy — the object, its parts, only the parts the system touches
3. Format variants — four external names collapsing to two internal shapes
4. Indexing — the standard scheme, its awkwardness, and the internal primary key
5. The property umbrella — and the plug-in abstraction that phases it
6. The problem taxonomy — as data (motif table + conventional fixes)
7. The second property — plus the corpus's most-emphasized trap
8. Inputs — what is consumed vs recomputed, and why
9. **The core mechanism** — the central idea, its matrix output, its honest limit
10. Decision logic I — triage, and the cost that justifies it
11. Generation — the combination formula and the procedure
12. Decision logic II — the annotation that replaced a rejected model
13. Ranking and the invariants — soft vs hard, and the honesty spine
14. End-to-end pipeline + the output contract + the loop that closes outside
15. Platform vocabulary
16. Tools, licenses, out-of-scope, and the corpus's own self-check questions

Note lessons 9 and 13 are the load-bearing ones; 2–8 exist to make 9 legible, and 10–12 are policy over 9's mechanism.

## Reusing the corpus's own check questions

Many mature specs carry a "before you start" or "confirm you can answer these" section. Reproduce those questions verbatim as the final lesson, with the corpus's own answers in collapsible blocks. They are the authors' statement of what a reader must hold, and they double as the seed for the quiz.
