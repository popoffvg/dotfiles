---
name: hunch
description: Use when a problem needs a non-obvious solution and the first answer feels too obvious, when several approaches compete, or when stuck. Generate competing solution theories, prune the dominated ones with recorded reasons, critique survivors before committing. Trigger on "find a non-obvious way", "generate theories/approaches", "I'm stuck", "think laterally", "explore approaches", "what else could solve this", "hunch".
argument-hint: [the problem to find a solution for]
model-invocation: false
user-invocation: true
---

# hunch — theories over the obvious answer

Chain-of-thought solution search, modelled on the [wayfinder pattern](https://github.com/mattpocock/skills/blob/main/skills/engineering/wayfinder/SKILL.md): the unit of progress is a **decision recorded as a thought** ([[thought]]), not a slice of build. A theory is a *hunch* — a bet on how to solve the problem. Generate several, favour the non-obvious, kill the dominated, commit one. Produce a **decision**, not the build — hand execution off after commit.

Run in-session by default: the map lives in the reply. Persist to a `hunch-<slug>.md` scratch file only when the exploration outgrows one reply or resumption is wanted.

## Flow

1. **Frame.** One line: what any solution must achieve. List the hard constraints and what is fixed. The frame fixes scope — a theory outside it is out of frame, not a candidate. Settle this first; it shapes every theory.
2. **Generate theories.** Produce 3–6 candidate approaches. Include one **obvious** baseline (the answer reached without this skill) as the bar to beat, then push past it — most candidates must be **non-obvious**. Use the techniques below. Tag each `obvious` or `non-obvious`.
3. **Prune (autonomous).** Score each against the frame. Drop any theory another **dominates** — beats on fit/cost/risk with no unique upside. Record the kill reason as a thought; never drop silently. Keep a risky non-obvious theory alive over a safe obvious one when it carries an upside the obvious lacks — collapsing to the obvious is the failure this skill exists to prevent.
4. **Deepen survivors.** For each: its cost, the assumption it rests on, where it breaks, the evidence that would confirm or kill it. Deepening may split one theory into sub-theories or surface a new one — add them as fresh thoughts (fog graduating, see below).
5. **Critique gate.** Before committing, present survivors **and** the killed theories with their kill reasons, and ask for critique — one exchange, [[grilling]]-style. The critique may revive a kill, kill a survivor, or add an angle. Do not commit before it.
6. **Commit.** Name the chosen theory, record the committing thought with why it won over the runner-up. Stop. Execution is a separate step the user triggers.

## Non-obvious generation techniques

Reach past the first answer by forcing a shift:

- **Invert** — solve the opposite, then negate the result.
- **Attack the constraint** — which "fixed" thing, if removed, dissolves the problem? Question every given.
- **Eliminate** — can the thing that needs solving be removed entirely rather than solved?
- **Change altitude** — solve one level up (why does this problem exist?) or one level down (a smaller sub-case that generalises).
- **Reverse the flow** — push↔pull, precompute↔on-demand, poll↔event.
- **Borrow** — how does another domain solve the isomorphic problem?
- **Reuse an existing asset** — a tool, table, or path already in the system that could carry the load instead of new machinery.

## Every decision is a thought

A thought is the atom of reasoning ([[thought]]); here it is a numbered line in the chain, not a heavyweight note. Log each move as a numbered thought — framing, generating, ranking, pruning, splitting, committing: one line each, decision + why. The thought log *is* the reasoning trace; a decision with no thought is not allowed.

## Fog of war

Do not chart theories that cannot be stated sharply yet. Generate what is crisp now; more surface as survivors deepen. The test for a candidate vs. fog is whether the approach can be **stated**, not whether it can be **judged** — an unjudged-but-statable approach is a theory; a vague direction is fog.

## Thought map

Kept in the reply; written to `hunch-<slug>.md` only when it outgrows one reply.

```markdown
# Hunch: <problem>

## Frame
<what any solution must achieve; hard constraints; what is fixed>

## Theories
- T1 (obvious): <gist> — [live | pruned: <reason> | committed]
- T2 (non-obvious): <gist> — [status]
- T3 (non-obvious): <gist> — [status]

## Thoughts
1. framed: <>
2. generated T1–T3 via invert, borrow, eliminate
3. pruned T1 — dominated by T2, no unique upside
4. deepened T2 — breaks if <>, confirm by <>
5. survivors T2, T3 → critique gate

## Out of frame
<approaches ruled outside the problem frame; revived only if the frame is redrawn>
```

## Rules

1. **Plan, don't do.** Output a committed decision, not the implementation. The pull to just build it is the signal the map is done and it is time to hand off.
2. **Beat the obvious or justify it.** The obvious baseline wins only when every non-obvious theory was killed for cause — recorded, not assumed.
3. **No silent kill.** Every pruned theory leaves a one-line reason in the thoughts.
4. **Critique before commit, not before prune.** Prune dominated theories autonomously; surface survivors for critique only at the gate.
5. **One frame at a time.** A theory outside the frame goes to *Out of frame*, not into the ranking. Redrawing the frame is a fresh hunch, not a resumption.
