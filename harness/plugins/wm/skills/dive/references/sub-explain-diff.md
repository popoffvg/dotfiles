# dive · explain-diff route

Draw a **two-panel architecture diff comparing two solutions** side by side. The common case is
`current` beside `planned`; the general case is any two candidates (`Solution A` beside
`Solution B`). Use it to weigh a refactor or migration, or to pick between two designs: what
changed, what is removed, what is new, what held, and the one load-bearing why.

Every rule both routes share — the stranger doctrine, the encodings, the shared procedure steps,
the anti-patterns, the done-when floor — is @ref-diagram.md. Read it first. This file adds only
what two panels need.

Write the page to `$RESEARCH_DIR/<slug>.arch-diff.html`.

**The mechanism to state is the delta's**: why the current design has the problem, and how the
candidate removes it.

## Procedure

1. **Name the seam.** Diagram only what differs between the two solutions plus its immediate
   anchors — never the whole system.
2. **Sort every element into one of five slots:** `unchanged · removed · new · changed · why`. Read
   the slots as the delta from the left panel to the right (baseline → candidate, or A → B). An
   element that fits none is cut. Open the diagram with a five-slot summary strip.
3. **Lay two panels on a shared coordinate grid.** Unchanged anchors keep the **same x,y** in both
   panels — then movement *means* a difference rather than noise. Side-by-side when panels are
   wider than tall; stacked when tall. Label each panel with the solution it shows.
4. **Fix the delta semantics:** added = green `+`, removed = red `✕`, changed = amber `~`,
   unchanged = grey and receding. These are the hues the shared redundancy rule pairs with a glyph
   and a label.
5. **Put the contract change beside its node** as a real red/green line diff, same colour
   semantics. **No signature change ≠ no change** — flag a behavioural-only shift explicitly,
   because silence reads as "unchanged".
6. Then the shared steps, in the order @ref-diagram.md § The shared procedure steps gives them.

## Where the diff shifts a shared rule

- **Contention** usually *removes* a hot spot: the baseline panel piles converging arrows on a
  ringed node, and the candidate panel fans them out to independent targets. The absent
  convergence is the fix.
- **Unchanged nodes that move or recolour between panels** is a seventh anti-pattern, and it is
  this route's most common failure — the reader cannot tell a difference from drift.

## Done when

The shared floor holds, and the reader can also answer all five slots, name the removed hot spot
and its failure mode, and trace each headline **difference** to a decision id.
