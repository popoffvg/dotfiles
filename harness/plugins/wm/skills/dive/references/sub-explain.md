# dive · explain route

Draw a **single-panel diagram of the planned architecture**. Use it for a quick-review picture of
one design; to compare two designs side by side (current vs planned, or option A vs B), use
`explain-diff`.

Every rule both routes share — the stranger doctrine, the encodings, the shared procedure steps,
the anti-patterns, the done-when floor — is @ref-diagram.md. Read it first. This file adds only
what one panel needs.

Write the page to `$RESEARCH_DIR/<slug>.arch.html`.

## Two reading layers

The panel serves two readers at once, neither assuming project knowledge:

- **30-second layer** — the diagram, its legend, and the term glossary. The reader parses the
  components, the edges, and every label straight off the page.
- **deeper layer** — the mechanism paragraph plus load-bearing callouts. The reader learns *how the
  phenomenon arises* and *how the core flow works* — the causal chain, not only the topology.

## Procedure

1. **Name the scope.** Diagram only the planned change's components plus their immediate anchors —
   never the whole system. An element that neither changes nor anchors a change is cut.
2. **Collect the vocabulary first.** List every project term the diagram and callouts will use, and
   write each one's one-line glossary entry before drawing anything.
3. **Write the mechanism paragraph** — the causal *how*, in plain language, before the diagram. It
   answers "how does the headline phenomenon arise?" and "how does the core flow work?" For a
   content-fingerprint design: how a conflict *arises* — recovery promises a fingerprint before the
   work re-runs, and a non-reproducible re-run produces a different one than promised; and how
   *recovery works* — predict the fingerprint from the glossary, let downstream run in parallel on
   the prediction, reconcile when the real re-run lands.
4. **Place components on a grid**, grouped by layer or bounded context, so the reader parses
   regions rather than a cloud of boxes.
5. Then the shared steps, in the order @ref-diagram.md § The shared procedure steps gives them.
