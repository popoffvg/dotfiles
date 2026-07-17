# dive · explain route

Draw a **single-panel diagram of the planned architecture** — a reviewer reads it in **30 seconds** to grasp the intended design. One picture of where the change lands, not a before/after. The diagram is a *transfer to the reviewer*, not a diary for the author.

Use for a quick-review picture of one design. To compare two designs/solutions side by side (current vs planned, or option A vs B), use `explain-diff`.

Encoding rules (edge strokes, self-contained HTML, time/lock/contention sub-encodings): [arch-diff-diagram-guide.html](arch-diff-diagram-guide.html) — apply the single-panel subset. A worked instance to copy the skeleton from: [example-async-resource-counter.html](example-async-resource-counter.html).

## Output location

Write the finished HTML to `$RESEARCH_DIR/<slug>.arch.html` (resolve `$RESEARCH_DIR` per the SKILL's "Output location" — `<notes-dir>/research/` by default, or the `dst:` override). Open it after writing; the diagram's correctness is visual.

## Procedure

1. **Name the scope.** Diagram only the planned change's components plus their immediate anchors — never the whole system. If an element neither changes nor anchors a change, cut it.
2. **Place components on a grid**, grouped by layer / bounded context so the reader parses regions, not a cloud of boxes.
3. **Give each edge relation its own stroke:** control `→` solid · data `⇒` thick/double · dependency `⋯▷` dotted · derive/refresh `⟳` curved. Never overload one style. Keep one **legend visible** near the panel (sticky) — a diagram whose strokes must be memorised is a quiz.
4. **Encode with redundancy, never colour alone:** hue **and** glyph **and** label, so it survives grayscale and colourblindness.
5. **Annotate only load-bearing decisions** — a short callout per node, tagged with a decision id (`A-0005`, `D-07`) that points to the full record. Three callouts, not thirty.
6. **Ship as a single self-contained HTML file** (inline `<style>`, inline `<svg>`, no external fetch). Theme-aware via `prefers-color-scheme` + `:root[data-theme]`. Wide SVGs scroll inside their own `overflow-x:auto` box; the page never scrolls sideways.
7. **Verify it renders** before claiming done (load the `verify` / visual-artifact check) — the diagram's correctness is visual.

## The three hard sub-encodings

- **Time.** Continuous state = solid level line (defined every instant). Discrete/slot state = dots sampled at slot edges with a **dashed hold** between (undefined between slots — don't draw it continuous). Eventual consistency = a shaded **delay window** from "became true" to "observed". Draw a discrete truth as continuous and the picture lies.
- **Locks — scope × mode.** Scope = the box you draw the band around (per-resource hugs one; global wraps the map). Mode = fill (shared/read = hatched/porous; exclusive/write = solid/opaque). **Stop-the-world reads off the picture**: it's scope × exclusive — per-resource exclusive turns *one* box solid while the rest stay hatched; global exclusive turns all solid (reserve for the rare whole-map op).
- **Contention.** Draw the fan-in — many actors → one node = converging arrows piling on a ringed node with its failure mode named (`ErrConflict`, retry storm). When the design fans out to independent targets instead, let the whitespace speak — the absent convergence *is* the property.

## Anti-patterns

- Colour with no paired glyph/label (dies in grayscale) — the most common failure.
- Decoration (3D, gradients, shadows) — ink without meaning.
- Arrow spaghetti — if lines cross more than they inform, split into two diagrams.
- A full system map — it buries the design; draw the seam.
- Three concepts on one canvas — one idea per region (contention here, locking there, time in a third).

## Done when

A reviewer can, in one pass and without asking the author: read the planned components and their relations, tell the edge types apart from the on-page legend, read every colour from the legend, see when discrete state exists vs is undefined, distinguish per-resource from global freeze, and trace each headline choice to a decision id.
