---
name: thought
description: This skill should be used when a skill, agent, or plan refers to a "thought", a "thought graph", a "thoughts/" note, or an instruction to "record each decision as a thought" — e.g. the code skill's spec notes or the hunch skill's decision chain — or when the user asks what a thought is. Defines the concept (the atom of reasoning); each consumer keeps its own format.
user-invocable: false
---

# thought — the atom of reasoning

A **thought** is one recorded decision or fact, with its *why*. The unit of progress in planning and design: a decision recorded as a thought, not a slice of build. Thoughts accumulate into a graph — the reasoning trace a human or agent reads to see why the work is shaped as it is.

Format-agnostic. A thought may be a heavyweight note — frontmatter, one file per thought (the `code` skill's `thoughts/`) — or a lightweight numbered line in a chain (the `hunch` skill). The concept below is constant; each consumer owns its format.

## Kinds

| Kind | The answer… |
|------|-------------|
| **decision** | is a choice — one option picked over named alternatives. |
| **fact** | establishes a truth the decisions rest on. |

A consumer may extend these — the `code` skill adds **impl-decision**, a choice made while implementing. The two above are the base.

## Rules

1. **Every decision is a thought.** No silent decision — a decision with no recorded thought is not allowed. Framing, choosing, pruning, committing: each is a thought.
2. **Record the why.** Decision plus reason, together. A thought without its reason is a fact stripped of its trace.
3. **No silent kill.** A pruned, superseded, or wrong thought leaves its reason. Deprecate, never delete — the history of wrong decisions is as valuable as the right ones.
4. **Fix the thought before the artifact.** Code (or a spec, or a plan) corrected without correcting its thought drifts back. A thought corrected without fixing the artifact is philosophy.
5. **Thoughts link.** Trace backward to what a thought depends on, forward to what it affects. The graph is self-documenting: a questioned decision shows its alternatives and why they lost.
