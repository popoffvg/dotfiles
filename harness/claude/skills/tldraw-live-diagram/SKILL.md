---
name: tldraw-live-diagram
description: Use the tldraw-live scripts only when the human must hand-place the boxes of a component or dataflow diagram and keep those positions across sessions — a saved tldraw document read back or reseeded, or box spacing in one. For any other movable component or dataflow diagram, the answer is an interactive Artifact — see the `dataflow` skill. Do not use the tldraw MCP tools — they never execute in Claude Code.
---

# tldraw live diagram

For a movable diagram that does not need hand-placed, position-persistent boxes, use the
interactive Artifact owned by `dataflow` (its "Draw it as an Artifact" section) instead of this
skill.

Two scripts under `~/.claude/scripts/tldraw-live/` own the whole flow. Never write a tldraw
snapshot by hand: it is tens of kilobytes for a dozen boxes.

| Step | Command |
| --- | --- |
| Write the seed | you write `<stem>.seed.json` (format below) |
| Place the boxes for you | `~/.claude/scripts/tldraw-live/fit-layout.py <stem>.seed.json` |
| Open the editor | `~/.claude/scripts/tldraw-live/serve.py <stem>.json` |
| Read it back | `~/.claude/scripts/tldraw-live/read-doc.py <stem>.json` |
| Fold a hand layout into the seed | `read-doc.py <stem>.json --seed > <stem>.seed.json` |
| Rebuild from a changed seed | `serve.py <stem>.json --reseed` |

**Write the boxes and arrows, then let `fit-layout.py` choose the cells.** Placing a graph by
hand is a losing game past a dozen boxes: it searches column order within each row band, scores
crossings and label collisions with the same geometry the page uses, and rewrites `row`/`col` in
the seed. It keeps rows semantic — a box's kind decides its band — so the result still reads
downward. It prints what it could not fix.

`serve.py` needs a browser and blocks. Run it with `run_in_background: true`, or hand the
command to the user. The browser writes every edit straight back to `<stem>.json`.

## Place boxes on the grid, never in pixels

**Give each box a `row` and a `col`, not an `x` and a `y`.** The page turns a cell into pixels
with one gutter constant, so every neighbour gets the same air. Hand-picked pixels are how
diagrams come out crowded: boxes 330 wide with a 20px gap read as one blob, and an arrow bound
centre-to-centre has no room to route between them.

```json
{
  "clusters": [
    { "id": "app",   "text": "the app",   "color": "blue" },
    { "id": "store", "text": "storage",   "color": "green" }
  ],
  "boxes": [
    { "id": "cli",    "cluster": "app",   "row": 0, "col": 0, "colSpan": 2, "text": "cli\nparses args" },
    { "id": "model",  "cluster": "app",   "row": 1, "col": 0, "text": "model\nthe state" },
    { "id": "disk",   "cluster": "store", "row": 0, "col": 0, "text": "disk\nthe rows" }
  ],
  "arrows": [
    { "from": "cli", "to": "model", "text": "config" },
    { "from": "model", "to": "disk", "text": "rows", "kind": "arc" }
  ]
}
```

A cell is 330 wide and 150 tall. The column gutter is 90; the row gutter is larger, because a
row gutter is where the arrow labels land. `colSpan` and `rowSpan` grow a box across cells and
swallow the gutters they cover, so a spanning box still lines up with its neighbours.

**A box grows to fit its own text.** The page measures the text against the box width and grows
the box downward when it does not fit, so text never spills past the border. Write the text you
need and leave the height alone — there is no `w` or `h` on a grid box.

**One idea per column, one layer per row.** Read the diagram left to right for a dataflow, top
to bottom for a layering.

## Group boxes into clusters

**Declare a `clusters` list and put each box in one.** A cluster becomes a titled tldraw frame:
it reads as one thing, and it drags as one thing, which is what the human wants when they start
rearranging. Clusters lay out left to right in declared order with a full column between them.

- `row` and `col` on a clustered box are **cluster-local** — every cluster starts its own grid
  at `0,0`.
- A cluster's `color` is the default for its member boxes; a box's own `color` still wins.
- A box with no `cluster` keeps the plain absolute grid and gets no frame, so an old seed draws
  exactly as it did.

## Arrows route as elbows

**Arrows are elbow arrows by default** — orthogonal, so they read as channels rather than as a
star of diagonals. Pass `"kind": "arc"` on an arrow that genuinely wants the curve.

An elbow arrow routes around a box only when a corner is free. Two boxes that talk to each other
belong next to each other, on the same row or the same column; a hop that moves on both axes
needs one of its two corner cells empty.

**Write a reply as its own arrow.** Two arrows on one pair of boxes get their anchors spread
across the faces they leave from, so a request and its response draw as two lines with two
labels instead of one line carrying both. The page picks the axis from how the pair is separated
— a stacked pair fans sideways, a side-by-side pair fans vertically. So `a -> b` and `b -> a` is
the right way to say "and the answer comes back", and one arrow labelled with both payloads is
not.

## Read the three faults the page reports

The status box and the console name every fault after a build. Each one is a bug in the seed, not
a cosmetic quibble:

| Fault | What it means | The fix |
| --- | --- | --- |
| `crowded` | two boxes sit closer than one gutter | give one of them a different cell |
| `arrow travels past a box` | a box sits in the corridor between the arrow's two ends | move the two ends onto the same row or column, or move the box out of the corridor |
| `label on a box` | the label's own rectangle overlaps a box at every placement the elbow could use | shorten the label, or shorten the hop |

`built from seed — clean` means all three passed.

**The corridor is the rectangle between an arrow's two ends, and any box inside it counts.** Not
just a box the line provably hits: whichever way the elbow routes, the arrow reads as travelling
past that box, and a diagram full of near-misses reads as a tangle. An arrow between neighbouring
cells has an empty corridor, so scoring corridors is the same thing as pulling the boxes that talk
to each other together. An axis-aligned hop has a zero-width corridor and never fails — which is
why two boxes that talk belong on one row or one column.

**Band order is a preference, not a constraint.** It is tempting to pin every entry point to the
top row and every outbound call to the bottom. Held hard, that pins a hub away from all five boxes
it talks to, and each of those arrows then sweeps a corridor full of siblings. Held as a scored
preference, the diagram still reads downward and the hub sits among its own partners. On the auth
dataflow this was the whole difference: nine corridor violations held hard, zero held soft.

## Raw pixels are for a hand layout only

`x`, `y`, `w`, `h` still work, and a box needs all four. This exists so
`read-doc.py --seed` can fold the human's own layout back into the seed — their positions are
deliberate and the grid must not overwrite them. Do not type pixels yourself.

## Box text

First line is the name, the rest is the detail; `read-doc.py` uses the first line to name the
box in arrow output. Text is monospace, small, top-left aligned, on a transparent fill.
`color` takes a tldraw colour name (`black`, `blue`, `red`, `green`, `orange`, `violet`,
`grey`) — use it to mark a group, not to decorate.
