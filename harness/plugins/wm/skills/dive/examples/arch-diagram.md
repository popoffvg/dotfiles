> The companion to `arch-diagram.html` — a finished diagram page, and the skeleton both diagram
> routes copy. HTML cannot carry `>` rule blocks, so this file names what the page demonstrates piece
> by piece and what a copy must replace. The rules themselves are `ref-diagram.md`; the shape of
> the two panels is `sub-explain-diff.md`, the single panel `sub-explain.md`.

# arch-diagram.html — what it demonstrates, piece by piece

The page is a filled **two-panel architecture diff**: reference counting moving from an in-place
counter on one hot key to an append-only log reduced by a garbage-collection pass. A single-panel
`explain` page keeps every piece below except the two panels and the five-slot strip.

| Piece | Where in the file | What it demonstrates | What a copy replaces |
|---|---|---|---|
| `<title>` and one inline `<style>` | lines 1–84 | The whole page is one file — a `<title>`, a single `<style>` block of CSS custom properties, and markup. No doctype, no `<head>`, no external fetch of any kind. | The title. Keep the token names; retune the hues only if the subject needs different semantics. |
| The light/dark token pair | `:root` at line 3, `@media (prefers-color-scheme:dark)` at line 15, `:root[data-theme]` at line 26 | Every colour is a token defined once on bare `:root` and redefined in the dark block, so the page follows the reader's OS theme and an explicit toggle. | Nothing. A copy that hard-codes one colour outside these blocks breaks in the other theme. |
| `header.masthead` | lines 86–95 | The four parts of a masthead: a `kicker` naming the page kind, an `h1` naming the subject, a `sub` paragraph carrying the mechanism in plain words with the `Why:` clause inside it, and the closing pointer at the glossary. | All four. The `sub` is the one place the causal chain is stated in words a stranger knows. |
| `div.legend`, `position:sticky` | lines 98–105 | The legend stays on screen while the reader scrolls: the four delta tokens, each a hue **and** a glyph (`+ ✕ ~ =`) **and** a word, plus the four edge strokes. | The tokens only if the page's semantics differ. Keep it sticky. |
| `section.gloss` | lines 113–130 | The glossary block: one `<div>` per term inside `div.gterms`, the term in `<b>`, its alias in `<span class="m">`, then a one-line definition. Ten terms, every one used on the page. | Every term. A term on the page and not in this block is the most common way the stranger test fails. |
| Five-slot summary strip | lines 132–178 | The delta as one SVG band labelled `UNCHANGED · REMOVED · NEW · CHANGED · WHY`, read before any diagram. | The five cells' contents. Keep all five labels, in this order. |
| A numbered panel section | lines 180–251 (`§ 1`) | The repeating unit: an `h2` with its number in `span.n`, a `p.lead` stating the mechanism, then `div.grid2` holding two `figure` panels that share one coordinate grid — unchanged nodes at the same `x,y` in both — each with a `paneltag` and a `small.note`. | The lead, the two SVGs, the panel tags, the notes. Keep the shared grid: movement must mean a difference. |
| `div.callout` with `span.did` | line 246, and one per section | A load-bearing decision, tagged with its decision id, sitting under the panel it explains. Four callouts on the whole page. | The ids and the text. Three or four callouts, never thirty. |
| Signatures-as-diffs section | lines 434–462 (`§ 5`) | The contract change as a real red/green line diff (`div.diffcode` with `dc-ctx` / `dc-rem` / `dc-add` rows), plus a `note` callout flagging a behaviour-only shift that no signature shows. | The diff rows. Keep the behaviour-only callout: silence reads as "unchanged". |
| "What did *not* change" section | lines 464–478 (`§ 6`) | The guard against over-reading a diff — a short list of the anchors that hold, each saying what moved *about* it and what did not. | The list. |
| `div.overflow` around every SVG | line 53 defines it, every panel uses it | A wide SVG scrolls inside its own box, so the page body never scrolls sideways. | Nothing. |

## Copying it

1. Copy the file to `$RESEARCH_DIR/<slug>.arch-diff.html` (or `<slug>.arch.html` for a single panel).
2. Replace the masthead, the glossary, and every panel. Delete the sections your subject has no content for — the numbered `h2` sequence renumbers.
3. Read `ref-diagram.md` § Done when and answer each of its questions against your page, then open the page in a browser and check both themes.

**It is a specimen, not a spec.** The full guide with the mockups behind these choices is
`references/arch-diff-diagram-guide.html`, and the rule a piece obeys is in `ref-diagram.md`. A
choice this page makes that neither of those states is a choice this page made, not a rule.
