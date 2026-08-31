# dive — the diagram contract

Every rule both diagram routes obey. `sub-explain.md` (one panel) and `sub-explain-diff.md` (two
panels) add only what their own shape needs, so a route file alone is half a spec.

Full spec + worked mockups: [arch-diff-diagram-guide.html](arch-diff-diagram-guide.html). A worked
instance to copy the skeleton from:
[example-async-resource-counter.html](example-async-resource-counter.html).

Write the page under `$RESEARCH_DIR/` — resolve it per the SKILL's § Output location
(`<notes-dir>/research/` by default, or the `dst:` override); the route names the suffix. Open it
after writing: the diagram's correctness is visual.

## Draw for a stranger

The reader knows general engineering and nothing about THIS project, so the page carries no
external *knowledge*, not merely no external fetch. Two rules carry that, and they are the two most
common failures:

1. **Define every project term on the page, at or before first use** — acronyms (`CID`), internal
   names (`SetFieldCID`), coined verbs (`zebra-clear`), mode names (`cidConflictMode`). A
   **glossary block**, one line per term, plus one prose expansion per acronym. A label the reader
   cannot decode is noise. A term you cannot define in one line you do not understand well enough
   to diagram.
2. **State the mechanism, not only the map** — one short plain-language paragraph above the
   diagram spelling the causal chain, which the diagram then illustrates. A newcomer can trace
   every arrow and still not know why a conflict occurs.

**Lead in plain language, tighten to jargon after.** The masthead uses words a stranger knows
("content fingerprint"); once the lead and glossary have grounded it, the diagram may use `CID`.
Every callout decodes alone.

## The shared procedure steps

Each route's numbered procedure ends with these, in order.

1. **Give each edge relation its own stroke:** control `→` solid · data `⇒` thick/double ·
   dependency `⋯▷` dotted · derive/refresh `⟳` curved. Never overload one style.
2. **Encode with redundancy:** hue **and** glyph **and** label, so it survives grayscale and
   colourblindness.
3. **Keep one legend visible** near the panel (sticky). A diagram whose strokes must be memorised
   is a quiz.
4. **Annotate only load-bearing decisions** — a short callout per node, tagged with a decision id
   (`A-0005`, `D-07`) pointing at the full record. Three callouts, not thirty.
5. **Ship one self-contained HTML file** — inline `<style>`, inline `<svg>`, no external fetch;
   theme-aware via `prefers-color-scheme` + `:root[data-theme]`; wide SVGs scroll inside their own
   `overflow-x:auto` box so the page never scrolls sideways.
6. **Verify it renders** before claiming done (load the `verify` / visual-artifact check).

## The three hard sub-encodings

- **Time.** Continuous state = solid level line (defined every instant). Discrete/slot state = dots
  at slot edges with a **dashed hold** between — draw it continuous and the picture lies. Eventual
  consistency = a shaded **delay window** from "became true" to "observed".
- **Locks — scope × mode.** Scope = the box the band wraps (per-resource hugs one; global wraps the
  map). Mode = fill (shared/read hatched; exclusive/write solid). **Stop-the-world reads off the
  picture**: scope × exclusive — per-resource turns *one* box solid while the rest stay hatched;
  global turns all solid, reserved for the rare whole-map op.
- **Contention.** Draw the fan-in — many actors → one node = converging arrows on a ringed node
  with its failure mode named (`ErrConflict`, retry storm). Where the design fans out to
  independent targets, let the whitespace speak: the absent convergence *is* the property.

## Anti-patterns

- **Undefined project jargon** — the single most common way the stranger test fails.
- **Topology without mechanism** — what connects, never how the phenomenon happens.
- Colour with no paired glyph or label — it dies in grayscale.
- Decoration (3D, gradients, shadows) — ink without meaning.
- Arrow spaghetti — lines crossing more than they inform; split into two diagrams.
- A full system map — it buries the design; draw the seam.
- Three concepts on one canvas — one idea per region.

## Done when

A reader who has **never seen this codebase or its vocabulary** can, in one pass and without asking
the author: expand every acronym and internal name from the page itself; state in plain words how
the headline phenomenon arises and how the core flow works; read the components and their
relations and tell the edge types apart from the legend; read every colour from the legend; see
when discrete state exists vs is undefined, and tell per-resource from global freeze; and trace
each headline choice to a decision id.

The route adds the checks its own shape needs.
