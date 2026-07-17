# dive · explain-diff route

Draw a **two-panel architecture diff comparing two solutions** side by side — that a reviewer reads in **30 seconds**. The common case is `current` beside `planned`; the general case is any two candidate designs (`Solution A` beside `Solution B`). The diagram is a *transfer to the reviewer*, not a diary for the author. Use to weigh a refactor/migration or pick between two designs: what changed, what's removed, what's new, what held, and the one load-bearing why.

Full spec + worked mockups for every rule: [arch-diff-diagram-guide.html](arch-diff-diagram-guide.html). A complete worked instance: [example-async-resource-counter.html](example-async-resource-counter.html) — start by copying its skeleton.

## Output location

Write the finished HTML to `$RESEARCH_DIR/<slug>.arch-diff.html` (resolve `$RESEARCH_DIR` per the SKILL's "Output location" — `<notes-dir>/research/` by default, or the `dst:` override). Open it after writing; the diagram's correctness is visual.

## Procedure

1. **Name the seam.** Diagram only what differs between the two solutions plus its immediate anchors — never the whole system.
2. **Sort every element into one of five slots:** `unchanged · removed · new · changed · why`. Read the slots as the delta from the left panel to the right (baseline → candidate, or A → B). If an element fits none, cut it. Open the diagram with a five-slot summary strip.
3. **Lay two panels on a shared coordinate grid.** Unchanged anchors keep the **same x,y** in both panels — then movement *means* a difference, not noise. Side-by-side when panels are wider than tall; stacked when tall. Label each panel with the solution it shows.
4. **Encode with redundancy, never colour alone:** added = green `+`, removed = red `✕`, changed = amber `~`, unchanged = grey (recede). Hue **and** glyph **and** label, so it survives grayscale and colourblindness.
5. **Keep one legend visible** near the panels (sticky). A diagram whose colours must be memorised is a quiz.
6. **Give each edge relation its own stroke:** control `→` solid · data `⇒` thick/double · dependency `⋯▷` dotted · derive/refresh `⟳` curved. Never overload one style.
7. **Annotate only load-bearing differences** — a short callout per change, anchored to its node, tagged with a decision id (`A-0005`, `D-07`) that points to the full record. Three callouts, not thirty.
8. **Ship as a single self-contained HTML file** (inline `<style>`, inline `<svg>`, no external fetch). Theme-aware via `prefers-color-scheme` + `:root[data-theme]`. Wide SVGs scroll inside their own `overflow-x:auto` box; the page never scrolls sideways.
9. **Verify it renders** before claiming done (load the `verify` / visual-artifact check) — the diagram's correctness is visual.

## The three hard sub-encodings

- **Time.** Continuous state = solid level line (defined every instant). Discrete/slot state = dots sampled at slot edges with a **dashed hold** between (undefined between slots — don't draw it continuous). Eventual consistency = a shaded **delay window** from "became true" to "observed". Draw a discrete truth as continuous and the picture lies.
- **Locks — scope × mode.** Scope = the box you draw the band around (per-resource hugs one; global wraps the map). Mode = fill (shared/read = hatched/porous; exclusive/write = solid/opaque). **Stop-the-world reads off the picture**: it's scope × exclusive — per-resource exclusive turns *one* box solid while the rest stay hatched; global exclusive turns all solid (reserve for the rare whole-map op).
- **Contention.** The change usually *removes a hot spot*. Draw the fan-in — many actors → one node = converging arrows piling on a ringed node with its failure mode named (`ErrConflict`, retry storm). In the candidate panel, arrows **fan out** to independent targets; the absent convergence *is* the fix — let the whitespace speak.

## Signatures-as-diffs

Put the contract change as a real red/green line diff beside the panel node it explains, same colour semantics. **No signature change ≠ no change** — flag behavioural-only shifts explicitly (silence reads as "unchanged").

## Anti-patterns

- Colour with no paired glyph/label (dies in grayscale) — the most common failure.
- Unchanged nodes that move or recolour between panels — the reader can't tell difference from drift.
- Three concepts on one canvas — one idea per region (contention here, locking there, time in a third).
- Decoration (3D, gradients, shadows) — ink without meaning.
- Arrow spaghetti — if lines cross more than they inform, split into two diagrams.
- A full system map — it buries the diff; draw the seam.

## Done when

A reviewer can, in one pass and without asking the author: answer all five slots, name the removed hot spot and its failure mode, read every colour from the on-page legend, tell the edge types apart, see when discrete state exists vs is undefined, distinguish per-resource from global freeze, and trace each headline difference to a decision id.
