---
name: arch-diff-diagram
description: >
  Use when drawing a diagram of an architecture change for review — a two-panel
  current-vs-planned (before/after) picture that lets a reviewer see what changed,
  what's removed, what's new, what held, and the one load-bearing why. Triggers:
  "arch diagram", "architecture diff", "before/after diagram", "diagram this
  refactor/migration/change", "visualize the change", "current vs planned", or any
  request to render an architectural change as a reviewable picture (HTML/SVG).
---

# Architecture DIFF diagram

Draw a **two-panel diff** — `current` beside `planned` — that a reviewer reads in **30 seconds**. The diagram is a *transfer to the reviewer*, not a diary for the author. Full spec + worked mockups for every rule: [references/arch-diff-diagram-guide.html](references/arch-diff-diagram-guide.html). A complete worked instance: [references/example-async-resource-counter.html](references/example-async-resource-counter.html) — start by copying its skeleton.

## Procedure

1. **Name the seam.** Diagram only what the change touches plus its immediate anchors — never the whole system.
2. **Sort every element into one of five slots:** `unchanged · removed · new · changed · why`. If an element fits none, cut it. Open the diagram with a five-slot summary strip.
3. **Lay two panels on a shared coordinate grid.** Unchanged anchors keep the **same x,y** in both panels — then movement *means* change, not noise. Side-by-side when panels are wider than tall; stacked when tall.
4. **Encode with redundancy, never colour alone:** added = green `+`, removed = red `✕`, changed = amber `~`, unchanged = grey (recede). Hue **and** glyph **and** label, so it survives grayscale and colourblindness.
5. **Keep one legend visible** near the panels (sticky). A diagram whose colours must be memorised is a quiz.
6. **Give each edge relation its own stroke:** control `→` solid · data `⇒` thick/double · dependency `⋯▷` dotted · derive/refresh `⟳` curved. Never overload one style.
7. **Annotate only load-bearing changes** — a short callout per change, anchored to its node, tagged with a decision id (`A-0005`, `D-07`) that points to the full record. Three callouts, not thirty.
8. **Ship as a single self-contained HTML file** (inline `<style>`, inline `<svg>`, no external fetch). Theme-aware via `prefers-color-scheme` + `:root[data-theme]`. Wide SVGs scroll inside their own `overflow-x:auto` box; the page never scrolls sideways.
9. **Verify it renders** before claiming done (load the `verify` / visual-artifact check) — the diagram's correctness is visual.

## The three hard sub-encodings

- **Time.** Continuous state = solid level line (defined every instant). Discrete/slot state = dots sampled at slot edges with a **dashed hold** between (undefined between slots — don't draw it continuous). Eventual consistency = a shaded **delay window** from "became true" to "observed". Draw a discrete truth as continuous and the picture lies.
- **Locks — scope × mode.** Scope = the box you draw the band around (per-resource hugs one; global wraps the map). Mode = fill (shared/read = hatched/porous; exclusive/write = solid/opaque). **Stop-the-world reads off the picture**: it's scope × exclusive — per-resource exclusive turns *one* box solid while the rest stay hatched; global exclusive turns all solid (reserve for the rare whole-map op).
- **Contention.** The change usually *removes a hot spot*. Draw the fan-in — many actors → one node = converging arrows piling on a ringed node with its failure mode named (`ErrConflict`, retry storm). In `planned`, arrows **fan out** to independent targets; the absent convergence *is* the fix — let the whitespace speak.

## Signatures-as-diffs

Put the contract change as a real red/green line diff beside the panel node it explains, same colour semantics. **No signature change ≠ no change** — flag behavioural-only shifts explicitly (silence reads as "unchanged").

## Anti-patterns

- Colour with no paired glyph/label (dies in grayscale) — the most common failure.
- Unchanged nodes that move or recolour between panels — the reader can't tell change from drift.
- Three concepts on one canvas — one idea per region (contention here, locking there, time in a third).
- Decoration (3D, gradients, shadows) — ink without meaning.
- Arrow spaghetti — if lines cross more than they inform, split into two diagrams.
- A full system map — it buries the diff; draw the seam.

## Done when

A reviewer can, in one pass and without asking the author: answer all five slots, name the removed hot spot and its failure mode, read every colour from the on-page legend, tell the edge types apart, see when discrete state exists vs is undefined, distinguish per-resource from global freeze, and trace each headline change to a decision id.
