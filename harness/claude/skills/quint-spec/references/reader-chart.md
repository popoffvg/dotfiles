# Show the model to the reader

The reader is the person who decides whether the behavior is right: the operator, a reviewer, a PM. The reader does not read Quint. A reader chart shows the model as a Mermaid statechart in the reader's words, marks where a rule breaks, and tells each bug as a numbered path. Make one before every hand-off of a model result.

## 1. Write the view

A view is a Python file next to the model, `chart/view.py`. It holds four names:

- `state(v)` returns the label of one model state. `v` holds the vars without module prefixes: a map is a `dict`, a sum value without payload is its tag string (`"Dir"`).
- `step(action, picks, before, after)` returns the label of one step, or `None` to hide it. `action` is the action name, `picks` holds the `nondet` values.
- `rules` maps each invariant name to the reader's sentence for that rule.
- `title` names the chart.

Rules for the words:

- A state label MUST say what the reader can see or cares about ("Empty folders a, a/b, no write uses them"). It MUST NOT name a var, an action, or a type.
- A step label MUST say what happens, as the reader sees it ("the rename of a fails on an empty folder"). Two steps that end the same in the chart get the same label, so they share one arrow.
- A state label MUST keep apart the states that break different rules, and the states on a bug path. A merge that hides where a rule breaks hides the bug.
- A chart SHOULD stay near 20 arrows. Coarsen the labels first: one label for values that act the same. Then hide steps the reader does not need with `None`, and say in the hand-off which steps are hidden.

Done when every label reads as the reader's sentence and no label names model internals.

## 2. Run it

```sh
quint-statechart.py MODEL.qnt --main INSTANCE --view chart/view.py \
  --invariant NAME [--invariant NAME]... --traces 2000 --samples 200000 --steps 15 --out chart/INSTANCE
```

The script draws the chart from `--traces` sampled runs, checks each invariant with `--samples` runs, and adds each violation trace to the chart. It writes `chart.mmd` (states marked `breaks` with a note that names the rule) and `report.md` (each rule with its verdict and budget, each bug as a numbered path, the hidden steps). Use the sample budget of `rules/quint.md` step 5.

Draw one chart per instance that the decision compares, for example as built and with the fix. The reader sees the fix as an arrow that appears or a mark that goes away.

Done when each expected violation shows as a mark, and the arrow count is near 20.

## 3. Replay each bug in the code

A bug path in the model is a claim about the code. Before the hand-off, replay each path against the real code as a test, one step per action. If the bug does not occur in the code, the model is wrong until a test shows otherwise; fix the model, not the claim.

Done when each bug path has a test that fails on the current code, or the model is fixed.

## 4. Hand off

Give the reader, for each chart:

- the chart as a `mermaid` block;
- one line per bug: the rule, the reader's sentence for it, and the path as `report.md` numbers it;
- the scope: the sample budget, "a state that no sampled run reached is not drawn", and what the model leaves out;
- the command that draws the chart again.

A pass is "no violation in N samples", never "proved".
