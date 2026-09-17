---
name: board
description: Draw a component or dataflow diagram on a live board the human hand-places and keeps positioned across sessions, and hold a design discussion on that board — draw what you believe, hand it over, read their marks, redraw. Use when the human must place the boxes themselves, when a saved board is read back or reseeded, when the user says "let's discuss the design on a board", "draw it and I'll fix it", "discuss the scheme", or when a disagreement is easier pointed at than described. For any other movable diagram the answer is an interactive Artifact — see the `dataflow` skill. Do not use the tldraw MCP tools — they never execute in Claude Code.
---

# board — a diagram the human can move and mark

For a movable diagram that does not need hand-placed, position-persistent boxes, use the
interactive Artifact owned by `dataflow` (its "Draw it as an Artifact" section) instead of this
skill.

Two halves. **Drawing** is below: the seed format, the grid, clusters, arrows, and the three faults
the page reports. **Discussing** is § The round: the turn-taking and colour protocol that turn a
drawn board into a conversation.

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

## The round

| Step | What you do | Done when |
| --- | --- | --- |
| 1 Draw | write `<topic>.seed.json`, run `fit-layout.py`, then `serve.py <topic>.json` with `run_in_background: true` | the status box reads `built from seed — clean` |
| 2 Hand over | tell the human the URL, the one question this round is about, and the colour protocol below | you have asked and stopped — no polling, no further tool calls |
| 3 Wait | the human edits in the browser; edits save straight into `<topic>.json` | the human replies (e.g. "I fixed the scheme", "done", "look") |
| 4 Read | `read-doc.py <topic>.json` for the listing, and `read-doc.py <topic>.json --seed > <topic>.seed.json` to keep their layout | you have listed every red box, every new box, and every deleted one |
| 5 Answer | state in chat what each mark told you, then edit the seed and `serve.py <topic>.json --reseed` | no red remains, or a new round starts at step 2 |

**Never redraw a round the human has not seen.** Two rebuilds in one turn throw away the layout they were about to fix.

**Keep their positions.** Step 4's `--seed` fold is what makes the next round build on their arrangement rather than on the grid's opinion; skipping it silently discards the layout they moved by hand.

## The colour protocol

**In a discussion board, colour carries meaning, not grouping** — this overrides the rule above that colour marks a group. Print this legend to the human every time you hand the board over, and put it on the board as a box in the top-left cell.

| Colour | Who writes it | What it means | Your reply |
| --- | --- | --- | --- |
| black, blue, green | you | the part you believe is settled | leave it |
| orange | you | an open question — the box text is the question | wait for the human to answer it in the box |
| red | the human | wrong, or disputed | change it, or say plainly why you disagree before changing anything |
| violet | the human | something you missed entirely | fold it in; ask what feeds it and what it feeds |
| grey | either | out of scope for this round | leave it, keep it drawn |

**Ask at most three orange questions per round.** A board with ten questions gets answered as prose in chat, and the board stops being the conversation.

**An answer replaces the question text.** The human types over the orange box; you recolour it green when you have folded the answer in, so the board shows what is settled and what is still open.

## What to draw when the discussion is not a dataflow

The seed's boxes and arrows carry any pairwise structure, not only components:

- **A decision** — one box per option, arrows from a shared `the choice` box, orange box for the criterion in dispute.
- **A sequence** — one box per step down a column, arrows carrying what passes between steps.
- **A split** — one cluster per candidate boundary, boxes for what lands on each side; red then means "this belongs on the other side".

**One question per round, one board per question.** A board that answers "which boundary" and "which storage" at once comes back marked in a way neither of you can read.

## Close the discussion

When a round returns clean, do these three before writing any code:

1. Print the final board as a listing (`read-doc.py <topic>.json`) into the chat, so the agreement survives without the browser.
2. Save the seed beside the notes — `<notes-dir>/<topic>.seed.json` — so a later session reopens the same board with `serve.py`.
3. State the decision in one sentence per settled question, and name anything still grey.
