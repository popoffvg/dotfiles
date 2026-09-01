---
name: tldraw-live-diagram
description: Draw a component or dataflow diagram the human can then edit by hand, using the tldraw-live scripts. Use when asked to draw, diagram, or sketch an architecture, a component map, or a dataflow, when the user wants to move the boxes themselves, or when a saved tldraw document must be read back or reseeded. Also covers box spacing. Do not use the tldraw MCP tools — they never execute in Claude Code.
---

# tldraw live diagram

Two scripts under `~/.claude/scripts/tldraw-live/` own the whole flow. Never write a tldraw
snapshot by hand: it is tens of kilobytes for a dozen boxes.

| Step | Command |
| --- | --- |
| Write the seed | you write `<stem>.seed.json` (format below) |
| Open the editor | `~/.claude/scripts/tldraw-live/serve.py <stem>.json` |
| Read it back | `~/.claude/scripts/tldraw-live/read-doc.py <stem>.json` |
| Fold a hand layout into the seed | `read-doc.py <stem>.json --seed > <stem>.seed.json` |
| Rebuild from a changed seed | `serve.py <stem>.json --reseed` |

`serve.py` needs a browser and blocks. Run it with `run_in_background: true`, or hand the
command to the user. The browser writes every edit straight back to `<stem>.json`.

## Place boxes on the grid, never in pixels

**Give each box a `row` and a `col`, not an `x` and a `y`.** The page turns a cell into pixels
with one gutter constant, so every neighbour gets the same air. Hand-picked pixels are how
diagrams come out crowded: boxes 330 wide with a 20px gap read as one blob, and an arrow bound
centre-to-centre has no room to route between them.

```json
{
  "boxes": [
    { "id": "cli",    "row": 0, "col": 0, "colSpan": 2, "text": "cli\nparses args" },
    { "id": "model",  "row": 1, "col": 0, "text": "model\nthe state" },
    { "id": "store",  "row": 1, "col": 1, "rowSpan": 2, "color": "blue", "text": "store\ndisk" }
  ],
  "arrows": [
    { "from": "cli", "to": "model", "text": "config" },
    { "from": "model", "to": "store" }
  ]
}
```

A cell is 330 x 150 with a 90px gutter. `colSpan` and `rowSpan` grow a box across cells and
swallow the gutters they cover, so a spanning box still lines up with its neighbours. Grow the
span when text overflows — there is no `w` or `h` on a grid box.

**One idea per column, one layer per row.** Read the diagram left to right for a dataflow, top
to bottom for a layering. Leave a whole empty row or column between groups; that reads as a
boundary without a frame.

The page reports crowded pairs in the status box and the console when any two boxes end up
closer than one gutter. Treat that message as a bug in the seed.

## Raw pixels are for a hand layout only

`x`, `y`, `w`, `h` still work, and a box needs all four. This exists so
`read-doc.py --seed` can fold the human's own layout back into the seed — their positions are
deliberate and the grid must not overwrite them. Do not type pixels yourself.

## Box text

First line is the name, the rest is the detail; `read-doc.py` uses the first line to name the
box in arrow output. Text is monospace, small, top-left aligned, on a transparent fill.
`color` takes a tldraw colour name (`black`, `blue`, `red`, `green`, `orange`, `violet`,
`grey`) — use it to mark a group, not to decorate.
