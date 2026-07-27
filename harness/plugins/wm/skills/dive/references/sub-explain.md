# dive · explain route

Draw a **single-panel diagram of the planned architecture** that a reader with **no prior knowledge of this project** understands from the page alone. The page is a *self-contained transfer*: a newcomer grasps the design without opening the code, asking the author, or already knowing the project's vocabulary. "Self-contained" means no external *knowledge* is required — not only no external fetch.

Two reading layers, neither assuming project knowledge:

- **30-second layer** — the diagram, its legend, and a term glossary. The reader parses the components, the edges, and every label straight off the page.
- **deeper layer** — a plain-language mechanism paragraph plus load-bearing callouts. The reader learns *how the phenomenon arises* and *how the core flow works* — the causal chain, not only the box-and-arrow topology.

Use for a quick-review picture of one design. To compare two designs side by side (current vs planned, or option A vs B), use `explain-diff`.

Encoding rules (edge strokes, self-contained HTML, time/lock/contention sub-encodings): [arch-diff-diagram-guide.html](arch-diff-diagram-guide.html) — apply the single-panel subset. A worked instance to copy the skeleton from: [example-async-resource-counter.html](example-async-resource-counter.html).

## Output location

Write the finished HTML to `$RESEARCH_DIR/<slug>.arch.html` (resolve `$RESEARCH_DIR` per the SKILL's "Output location" — `<notes-dir>/research/` by default, or the `dst:` override). Open it after writing; the diagram's correctness is visual.

## Explain for a stranger — the non-negotiables

The reader knows general engineering but nothing about THIS project. So:

1. **Define every project term on the page, at or before first use.** Acronyms (`CID`, `AID`, `TID`), internal subsystem names (`glossary`, `SetFieldCID`), coined verbs (`zebra-clear`, `recover`), mode names (`cidConflictMode`) — all opaque to a newcomer. Carry a **glossary block** (one line per term) and expand each acronym once in prose. A label the reader can't decode is noise, not information.
2. **State the mechanism, not only the map.** Topology (who points at whom) does not tell a newcomer *how the headline phenomenon happens*. Spell the causal chain in plain words. For the CID example: how a conflict *arises* — recovery promises a content fingerprint before the work re-runs, and a non-reproducible re-run produces a different fingerprint than promised; and how *recovery works* — predict the fingerprint from the glossary, let downstream run in parallel on the prediction, reconcile when the real re-run lands. One short mechanism paragraph up top; the diagram illustrates it.
3. **Lead in plain language, tighten to jargon after.** The masthead/lead uses words a stranger knows ("content fingerprint", "skip work already done"); once the lead and glossary have grounded it, the diagram may use the project's own term (`CID`).
4. **Every callout decodes alone.** A callout that leans on an undefined term fails the stranger test — inline the meaning or point at the glossary.

## Procedure

1. **Name the scope.** Diagram only the planned change's components plus their immediate anchors — never the whole system. If an element neither changes nor anchors a change, cut it.
2. **Collect the vocabulary first.** List every project term the diagram and callouts will use; write each one's one-line glossary entry. If you can't define a term in one line, you don't understand it well enough to diagram it.
3. **Write the mechanism paragraph** — the causal *how*, in plain language, before the diagram. It answers "how does the headline phenomenon arise?" and "how does the core flow work?"
4. **Place components on a grid**, grouped by layer / bounded context so the reader parses regions, not a cloud of boxes.
5. **Give each edge relation its own stroke:** control `→` solid · data `⇒` thick/double · dependency `⋯▷` dotted · derive/refresh `⟳` curved. Never overload one style. Keep one **legend visible** near the panel (sticky) — a diagram whose strokes must be memorised is a quiz.
6. **Encode with redundancy, never colour alone:** hue **and** glyph **and** label, so it survives grayscale and colourblindness.
7. **Annotate only load-bearing decisions** — a short callout per node, tagged with a decision id (`A-0005`, `D-07`) that points to the full record. Three callouts, not thirty.
8. **Ship as a single self-contained HTML file** (inline `<style>`, inline `<svg>`, no external fetch). Theme-aware via `prefers-color-scheme` + `:root[data-theme]`. Wide SVGs scroll inside their own `overflow-x:auto` box; the page never scrolls sideways.
9. **Verify it renders** before claiming done (load the `verify` / visual-artifact check) — the diagram's correctness is visual.

## The three hard sub-encodings

- **Time.** Continuous state = solid level line (defined every instant). Discrete/slot state = dots sampled at slot edges with a **dashed hold** between (undefined between slots — don't draw it continuous). Eventual consistency = a shaded **delay window** from "became true" to "observed". Draw a discrete truth as continuous and the picture lies.
- **Locks — scope × mode.** Scope = the box you draw the band around (per-resource hugs one; global wraps the map). Mode = fill (shared/read = hatched/porous; exclusive/write = solid/opaque). **Stop-the-world reads off the picture**: it's scope × exclusive — per-resource exclusive turns *one* box solid while the rest stay hatched; global exclusive turns all solid (reserve for the rare whole-map op).
- **Contention.** Draw the fan-in — many actors → one node = converging arrows piling on a ringed node with its failure mode named (`ErrConflict`, retry storm). When the design fans out to independent targets instead, let the whitespace speak — the absent convergence *is* the property.

## Anti-patterns

- **Undefined project jargon** — an acronym or internal name used with no on-page definition. The single most common way the stranger test fails.
- **Topology without mechanism** — boxes and arrows that show *what connects* but never *how the phenomenon happens*. A newcomer can trace every arrow and still not know why a conflict occurs.
- Colour with no paired glyph/label (dies in grayscale).
- Decoration (3D, gradients, shadows) — ink without meaning.
- Arrow spaghetti — if lines cross more than they inform, split into two diagrams.
- A full system map — it buries the design; draw the seam.
- Three concepts on one canvas — one idea per region (contention here, locking there, time in a third).

## Done when

A reader who has **never seen this codebase or its vocabulary** can, in one pass and without asking the author:

- expand every acronym and internal name from the page itself (glossary + first-use expansion);
- state in plain words how the headline phenomenon arises and how the core flow works (mechanism paragraph);
- read the planned components and their relations, and tell the edge types apart from the on-page legend;
- read every colour from the legend;
- see when discrete state exists vs is undefined, and distinguish per-resource from global freeze;
- trace each headline choice to a decision id.
