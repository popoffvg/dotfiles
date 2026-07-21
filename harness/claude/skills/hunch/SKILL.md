---
name: hunch
description: Use to brainstorm in an unknown field where the first frame is wrong and the good answer is counterintuitive — diverge wide with judgment suspended, sense which probes emerge, then converge on one once the field is knowable. Trigger on "brainstorm", "explore an unknown", "find a non-obvious/counterintuitive way", "I'm stuck", "think laterally", "widen the board", "generate probes/approaches", "what else could solve this", "hunch".
argument-hint: [the messy situation to explore]
model-invocation: false
user-invocation: true
---

# hunch — probes over the obvious frame

Brainstorming for unknown fields, then a disciplined commit. A *hunch* is a **probe** — a cheap experiment, not an answer to defend. Diverge wide first, keep judgment suspended, sense which probes emerge; converge only when the field has become knowable. Produce a **decision**, not the build — hand execution off after commit.

Two mental models run together, nested, and one governs the phase you are in:

- **[Cynefin](https://en.wikipedia.org/wiki/Cynefin_framework)** sets the phase. The unknown field is **Complex** — un-analyzable up front — so you **probe → sense → respond**: run many safe-to-fail experiments, sense what emerges, amplify winners. You do not reason the answer out; you let it surface. Sensing *moves* the field: once probes reveal what actually constrains the outcome, the field is now **Complicated** — analyzable — and only *then* do you converge and commit.
- **[TRIZ](https://en.wikipedia.org/wiki/TRIZ) — contradiction resolution** is one *engine* feeding the divergent phase. It manufactures counterintuitive probes by **refusing the tradeoff** the obvious answer accepts, and by **borrowing** how other fields solved the same contradiction.

**TRIZ proposes, Cynefin disposes.** TRIZ wants to converge on the clever answer early; that instinct belongs to the Complicated phase, not the Complex one. Every TRIZ output enters the board **stripped of its "this is the answer" claim** — a candidate probe, never a verdict. That one rule stops the two models from fighting, and stops the board collapsing to the obvious before it is full.

Run in-session by default: the board lives in the reply. Persist to a `hunch-<slug>.md` scratch file only when it outgrows one reply or resumption is wanted.

## Flow

Steps 1–5 diverge (Complex); step 6 converges (Complicated). Do not converge early.

1. **Frame the mess — not a goal.** State the tangled situation and, explicitly, **what is unknown**. Do **not** name a single constraint or success metric yet — naming one collapses the field to Complicated before you have earned it and kills divergence. The frame here is deliberately open: its purpose is to license wide, not to fix scope.
2. **Generate probes wide (parallel engines).** Fill the board — **12+ is a floor, not a ceiling**. Two engines run concurrently onto one board:
   - **TRIZ stream** — state the contradiction ("to get X we must worsen Y"), refuse it, resolve without compromise (see below). Counterintuitive by construction.
   - **Diversity stream** — deliberately dissonant, oddball, contrarian probes via provocation (see below).
   Each probe is **safe-to-fail** and phrased as an experiment ("try Z, watch for W"), not a solution. TRIZ output lands stripped of its verdict claim. Invite the user to add their own; each enters the same board with no privilege.
3. **Suspend judgment (the hard rule).** **No pruning in this phase.** Quantity over quality; wild is welcome; build on and recombine others' probes. Deferring judgment is the rule brainstorming cannot give up — it is why divergence and convergence are separate phases here, not one funnel.
4. **Sense (safe-to-fail).** For each probe define the **cheap test** and the **signal** that says it is emerging — what you would observe if it is working. Run what you can now. Read the field, do not argue it. *Safe-to-fail, not fail-safe*: a probe is allowed to die cheaply.
5. **Amplify / dampen.** Feed the probes showing signal (spawn variants, recombine, deepen); dampen the rest — **dampen ≠ kill-with-reason**. Keep the whole board; a dampened probe can revive when the field shifts. Loop 2–5 while the board is still producing genuinely new probes.
6. **Converge — once the field is knowable.** The board is dry and sensing has revealed **what actually constrains the outcome**: the field has moved Complex → Complicated. *Now* name that constraint, rank the surviving probes by their effect on it (see [Converging](#converging)), present survivors and the reason each lost for one round of [[grilling]]-style critique, then commit one — recording why it won over the runner-up. Stop. Execution is a separate step the user triggers.

## TRIZ engine — counterintuition by refusing the tradeoff

The obvious answer accepts a compromise. TRIZ rejects it and asks for both:

- **Name the contradiction** — "to gain X we must worsen Y." Write it before solving.
- **Separate** to dissolve it — in **time** (X now, Y later), **space** (X here, Y there), **scale** (X for the whole, Y for the part), or **condition** (X when A, Y when B).
- **Ideality** — the ideal solution delivers the function with the machine *gone*: what performs X with zero cost/part? Aim there, retreat only as forced.
- **Resources** — solve using what is *already present* in the system (a byproduct, waste, idle capacity) before adding anything new.
- **Borrow across domains** — lift the contradiction to its general form, find a field that already resolved it, drop the solution back down. Your problem is likely solved elsewhere.

## Diversity engine — provocation

Force a frame-break so the board isn't all variations of the obvious:

- **PO / provocation** — assert something deliberately false ("PO: the system has no users"), then mine it for what it suggests.
- **Invert** — solve the opposite, then negate the result.
- **Challenge a given** — list the "fixed" facts, drop one, keep going as if it were free.
- **Random entry** — inject an unrelated word/domain and force a bridge to the problem.
- **Change altitude** — one level up (why does this field exist?) or down (a smaller sub-case that generalises).

## Converging

Only after emergence (step 6), never before. The transition is legitimate because sensing has made the field analyzable — the constraint is now *observed*, not guessed.

- **Name the constraint** the probes revealed — the single binding limit between the surviving probes and the goal that has now come into focus.
- **Rank survivors lexicographically** — effect on the constraint first; cost / risk / reversibility only to break ties. A cheap probe that barely moves the constraint loses to a costly one that breaks it.
- **Kill with a reason, now** — in this phase pruning *is* allowed and each kill cites what sank it. (Contrast the divergent phase, where you only dampen.)
- **Critique, then commit one.** One [[grilling]]-style exchange over survivors and kills; it may revive a probe or challenge the constraint. Then commit — record the winner and why it beat the runner-up. Note which constraint becomes binding next; that is the next hunch.

## Every move is a thought

A thought is the atom of reasoning ([[thought]]); here a numbered line on the board. Log each move — framing, each probe and its engine, sensing, amplify/dampen, the constraint named, the commit — one line, move + why. In the divergent phase a **dampen needs no kill-reason** (options are kept); every *amplify* records the signal that justified it; in the convergent phase every *kill* names the cell that sank it.

## Fog is welcome (in divergence)

While diverging, **embrace fog**: a half-formed direction is a legitimate probe, because in an unknown field the sharp statement often only appears *after* you poke it. Charter the vague; let sensing sharpen it. The test for a probe is whether it can be **tried cheaply**, not whether it can be stated or judged. (Convergence is the opposite: you commit only what can be stated sharply.)

## Board

Kept in the reply; written to `hunch-<slug>.md` only when it outgrows one reply.

```markdown
# Hunch: <the mess>

## Frame
<the tangled situation; what is UNKNOWN; no constraint, no metric yet — open on purpose>

## Probes
- P1 (triz): <gist> — resolves contradiction <X vs Y> by <separation> — [live | amplified | dampened | committed]
- P2 (diversity): <gist> — provocation <which> — [status]
- P3 (triz): <gist> — [status]
- … (aim wide — 12+)

## Sensing
| Probe | Cheap test | Signal it's emerging | Result   |
|-------|------------|----------------------|----------|
| P1    | <>         | <>                   | live     |
| P2    | <>         | <>                   | dampened |

## Converge (once the field is knowable)
Constraint revealed: <the single binding limit> — tie-breakers: Cost · Risk

| Probe | → Constraint | Cost | Risk | Verdict           |
|-------|:------------:|:----:|:----:|-------------------|
| P1    |      ++      |  −   |  o   | committed         |
| P3    |      +       |  +   |  ++  | runner-up         |
| P7    |    local     |  ++  |  +   | killed: off-constraint |

## Moves
1. framed the mess — unknown: <>
2. P1 via TRIZ (separate in time); P2 via invert; … (board at 14)
3. judgment suspended
4. sensed P1 — signal <>, amplified into P1a/P1b
5. dampened P2 — no signal (kept on board)
6. field now knowable — constraint = <>; committed P1 over P3 (moves the constraint, P3 doesn't)

## Next constraint
<what becomes binding once P1 lands — the next hunch's start>
```

## Rules

1. **Diverge before you decide.** Steps 1–5 fill the board with judgment suspended; convergence (step 6) starts only once sensing has revealed the constraint. Naming a constraint early collapses the field to Complicated before you have earned it — the failure this skill exists to prevent.
2. **Cynefin governs, TRIZ serves.** Every TRIZ probe enters stripped of its verdict claim — a candidate to test, not the answer. Never let the analytic engine collapse the board early.
3. **Keep the board while diverging.** A dampened probe is retained, not deleted; an unknown field shifts, and the recombination you need may be the idea that showed no signal today. Kill-with-reason belongs only to convergence.
4. **Wide first.** Do not narrow to a "promising" region before the board is full. Aim past the obvious cluster; most probes must break the first frame.
5. **Safe-to-fail probes only.** Every probe carries a cheap test and a signal. An idea you cannot try cheaply is a direction to reframe into a probe — but fog is fine in divergence; it need not be stated sharply.
6. **One board, no privilege.** Agent probes, the obvious baseline, and user-added probes share one board and one sensing. No probe is exempt; none is privileged for its source.
7. **Converge lexicographically.** When you commit: effect on the constraint first, cost/risk only to break ties — never a weighted sum that lets an off-constraint probe outrank one that moves it.
8. **Plan, don't do.** Output a committed decision, not the implementation. The pull to just build it is the signal the board is done and it is time to hand off.
