# Quint model of the machine

Use this file only when the user asks for a Quint model. The Quint syntax is `quint:quint-lang`. The end-to-end model build is `quint:quint-modeling`. Every rule in `SKILL.md` applies to the model as well.

## The model is the reference

**When the model and the code disagree, change the code to match the model.** Then turn each edge case the model found into a test in the code.

- Find the code in the correct worktree or branch before you say that it does not exist.
- A finding that the model has and the code cannot express yet (no marker in the code) is a named gap in the report. Do not drop it.

## Proving the model

**Each claim about the model needs a measurement that could fail.**

- Keep witness invariants (`witnessNoRunEverStarts`) that the simulator must violate. After each removal of a state, run them again. A witness that stops being violated means the search no longer reaches that part.
- A random-simulation `[ok]` is not a proof. Before you call a violation a regression, run the baseline model at a deeper search (for example 200 000 samples and 60 steps against 20 000 and 40).
- Mutation-check each new `run` test: put the old line back, see the test fail, then restore it.
- Save the model before a rework (for example `quint-before/` in the scratchpad), so the baseline stays measurable.

## Completion

The model is ready when the `SKILL.md` completion holds, every witness is still violated, and each edge case the model found has a test in the code or a named gap in the report.
