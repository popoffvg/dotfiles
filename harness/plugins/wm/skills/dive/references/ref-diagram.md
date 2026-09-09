# dive — the diagram contract

Every rule both diagram routes obey. `sub-explain.md` (one panel) and `sub-explain-diff.md` (two
panels) add only what their own shape needs, so a route file alone is half a spec.

Full spec + worked mockups: [arch-diff-diagram-guide.html](arch-diff-diagram-guide.html). A worked
instance to copy the skeleton from: `examples/arch-diagram.html`, and `examples/arch-diagram.md`
beside it names what that page demonstrates piece by piece and what a copy must replace.

Write the page under `$RESEARCH_DIR/` — resolve it per the SKILL's § Output location
(`<notes-dir>/research/` by default, or the `dst:` override); the route names the suffix. Open it
after writing: the diagram's correctness is visual.

## Draw for a stranger

The reader knows general engineering and nothing about THIS project, so the page carries no
external *knowledge*, not merely no external fetch. Two rules carry that, and they are the two most
common failures:

1. **Define every project term on the page, at or before first use** — acronyms (`CID`), internal
   names (`SetFieldCID`), coined verbs (`zebra-clear`), mode names (`cidConflictMode`). A label the
   reader cannot decode is noise. A term you cannot define in one line you do not understand well
   enough to diagram.

   The **glossary block** is where they land: one `<section>` between the legend and the first
   diagram, so it is read before any panel and after nothing. Its markup is one `<div>` per term —
   the term in `<b>`, its alias or expansion in a muted `<span>`, then one sentence of definition —
   and it carries every term the page uses and no others. A term used on the page and missing here
   is the single most common failure of the stranger test.
2. **State the mechanism, not only the map** — one short plain-language paragraph above the
   diagram spelling the causal chain, which the diagram then illustrates. A newcomer can trace
   every arrow and still not know why a conflict occurs.

**Lead in plain language, tighten to jargon after.** The masthead uses words a stranger knows
("content fingerprint"); once the lead and glossary have grounded it, the diagram may use `CID`.
Every callout decodes alone.

The **masthead** is the page's opening block, above the legend, and it carries four things in this
order: a kicker naming the page kind (`Architecture diff · current → planned`, or
`Planned architecture`), an `h1` naming the subject, one paragraph stating the mechanism in plain
words with the `Why:` clause inside it, and a closing line pointing a new reader at the glossary.
The paragraph is the one place the causal chain is written out in prose, which is why the page cannot
open with the diagram.

## The shared procedure steps

Each route's numbered procedure ends with these, in order.

1. **Give each edge relation its own stroke:** control `→` solid · data `⇒` thick/double ·
   dependency `⋯▷` dotted · derive/refresh `⟳` curved. Never overload one style.
2. **Encode with redundancy:** hue **and** glyph **and** label, so it survives grayscale and
   colourblindness.
3. **Keep one legend visible** near the panel (sticky). A diagram whose strokes must be memorised
   is a quiz.
4. **Annotate only load-bearing decisions** — a short callout per node, tagged with the id the
   decision record itself carries, so a reader can find that record. For a wm thought note the form
   is `D<NNN>` — the note's own id, never reused and never renumbered
   (`arch:ref-todo-sections.md` § Constraints owns it). For a decision recorded outside the wm
   corpus, use that corpus's own id verbatim. An id no record carries is worse than no id.
   Three callouts, not thirty.
5. **Ship one self-contained HTML file** — inline `<style>`, inline `<svg>`, no external fetch;
   theme-aware via `prefers-color-scheme` + `:root[data-theme]`; wide SVGs scroll inside their own
   `overflow-x:auto` box so the page never scrolls sideways.
6. **Verify it renders** before claiming done, with two checks you can run:
   `grep -nE 'https?://|<link|<script src|@import' <page>` must print nothing — that is the
   self-contained rule, mechanically. Then open the page (`open <page>` on macOS) and read it in
   both themes, because everything else about a diagram is visual and no command can judge it.

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
