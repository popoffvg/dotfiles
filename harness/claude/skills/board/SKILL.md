---
name: board
description: Draw a component or dataflow diagram on a live board the human hand-places and keeps positioned across sessions, and hold a design discussion on that board — draw what you believe, check its picture, hand it over, read their marks, redraw. Use when the human must place the boxes themselves, when a saved board is read back or reseeded, when the user says "let's discuss the design on a board", "draw it and I'll fix it", "discuss the scheme", or when a disagreement is easier pointed at than described. For any other movable diagram the answer is an interactive Artifact — see the `dataflow` skill. Do not use the tldraw MCP tools — they never execute in Claude Code.
---

# board — a diagram the human can move and mark

**You place the boxes by rules, then look at the picture of the board. Never compute where a box or a line lands.** Never write a tldraw snapshot by hand either: it is tens of kilobytes for a dozen boxes.

| Step | Command |
| --- | --- |
| Write the seed | you write `<topic>.seed.json` — § The seed |
| Open the editor | `~/.claude/scripts/tldraw-live/serve.py <topic>.json` |
| See the board | `Read <topic>.png` |
| Read it back as text | `~/.claude/scripts/tldraw-live/read-doc.py <topic>.json` |
| Fold a hand layout into the seed | `read-doc.py <topic>.json --seed > <topic>.seed.json` |
| Rebuild from a changed seed | `serve.py <topic>.json --reseed` |

Keep `<topic>.seed.json` and `<topic>.json` in `<notes-dir>/` — the wm notes directory, or the scratchpad when there is none — so a later session reopens the same board.

`serve.py` blocks: run it with `run_in_background: true`. The page writes every edit back to `<topic>.json`, and after every save it writes `<topic>.png`; `serve.py` prints `picture <path>` each time, so its output tells you the PNG is fresh. The PNG exists only while a browser has the page open.

## The round

| Step | What you do | Done when |
| --- | --- | --- |
| 1 Draw | write `<topic>.seed.json` by § Place boxes by these rules, in § The colour protocol colours from the first draw, then run § The draw loop | every gate passes, or five passes are done and the failed gates are named |
| 2 Hand over | run `open http://127.0.0.1:8791/`, tell the human the URL, the one question this round is about, and § The colour protocol | you have asked and stopped — no polling, no further tool calls |
| 3 Wait | the human edits in the browser | the human replies (e.g. "I fixed the scheme", "done", "look") |
| 4 Read | `Read <topic>.png` to see their marks where they put them, `read-doc.py <topic>.json` for the listing, and `read-doc.py <topic>.json --seed > <topic>.seed.json` to keep their layout | you have compared the listing with your seed and listed every red box, every new box, and every deleted one |
| 5 Answer | state in chat what each mark told you, then edit the seed and `serve.py <topic>.json --reseed` | no red or violet remains and every orange box is answered, or a new round starts at step 2 |

**Never redraw a round the human has not seen.** Two rebuilds in one turn throw away the layout they were about to fix.

**Never skip the `--seed` fold in step 4.** Without it the next round builds on the grid, not on the boxes they moved by hand.

**When a round returns clean, close it before you write any code:**

1. Print `read-doc.py <topic>.json` into the chat, so the agreement survives without the browser.
2. State the decision in one sentence per settled question, and name anything still grey.

## The draw loop

**Redraw until every gate passes.** Never hand over a board with a failed gate that you did not name.

| Gate | Where you read it | Passes when |
| --- | --- | --- |
| G1 page faults | the status line the headless run prints | it reads `built from seed — clean` — § Page faults |
| G2 no line through a box | `<topic>.png` | no line passes through or behind a box that is not one of its two ends |
| G3 labels clear | `<topic>.png` | no label sits on a box, on a line it does not belong to, or on another label |
| G4 text inside | `<topic>.png` | all text stays inside its box border |
| G5 arrows whole | `<topic>.png` | each arrow is visible end to end, and a request and its reply draw as two lines |
| G6 one direction | `<topic>.png` | the eye reads the flow top to bottom, or left to right |

Start the server once, in the background. `--no-open` keeps the human's browser closed on a board you have not checked:

```sh
~/.claude/scripts/tldraw-live/serve.py <topic>.json --no-open --reseed
```

Then repeat one pass until all six gates pass:

1. **Build.** Delete the document and load the page in headless Chrome, with the sandbox off — the sandbox blocks Chrome. With no document, the page builds the board from the seed, saves it, and writes the PNG.

   ```sh
   rm -f <topic>.json
   timeout 40 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
     --user-data-dir="$TMPDIR/board-chrome" --virtual-time-budget=20000 --dump-dom http://127.0.0.1:8791/ \
     | grep -o '<div id="status">[^<]*'
   ```

   Chrome does not exit after it prints the page, so `timeout` stops it; `Terminated: 15` is the normal end. The status line holds the build result, then ` · saved <time>`.

2. **Read the gates.** G1 from the status line, G2–G6 from `Read <topic>.png`. Write each failed gate in chat as one line: the gate, the boxes, the arrow.
3. **Fix the seed.** One change per failure, by § Place boxes by these rules: move a box to another cell, put two boxes that talk on one row or column, shorten a label, split a cluster.
4. **Go to step 1.**

**Stop after five passes.** When the same gate fails on two passes in a row, the last fix did not touch the cause — move a different box, or split the cluster. After the fifth pass, hand the board over and name each gate that still fails.

**The loop is for the seed only.** Step 1 deletes the document and the human's hand layout with it. Never run it after the human starts to edit.

## Place boxes by these rules

Choose each `row` and `col` with these rules, in this order:

1. **Two boxes that talk share a row or a column.** An arrow along one axis can never cross a box.
2. **Put a hub among its partners.** A box with many arrows goes in the middle column, and its partners go around it on the same rows and columns.
3. **A hop on both axes needs one free corner cell.** If `a` is at `0,0` and `b` at `1,1`, keep `0,1` or `1,0` empty, so the elbow has a path.
4. **Keep the cells between an arrow's two ends empty.** A box in that rectangle reads as if the arrow travels past it.
5. **Entry points go in the top row, outbound calls in the bottom row — unless that breaks rule 1 or 2.** A hub pinned away from its partners makes every arrow cross a sibling.
6. **Keep a label to three words or less.** A long label lands on a box.
7. **Put each group in one cluster, and keep a cluster to about six boxes.** A bigger group is two clusters.
8. **One idea per column, one layer per row.** Left to right for a dataflow, top to bottom for a layering.

## The seed

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

**Give each box a `row` and a `col`, never `x`, `y`, `w`, `h`.** The page turns cells into pixels with one gutter, so every neighbour gets the same space; hand-picked pixels come out crowded. `colSpan` and `rowSpan` grow a box across cells. A box grows downward to fit its own text, so write the text and leave the height alone. Pixel boxes (all four of `x`, `y`, `w`, `h`) exist only so `read-doc.py --seed` can keep the human's own layout.

**Put each box in a cluster.** A cluster becomes a titled frame that reads and drags as one thing. Clusters lay out left to right in declared order, with a full column between them.

- `row` and `col` on a clustered box are cluster-local — every cluster starts its own grid at `0,0`.
- A cluster's `color` is the default for its boxes; a box's own `color` wins.
- A box with no `cluster` uses the absolute grid and gets no frame.

**Box text:** the first line is the name — `read-doc.py` names the box by it in arrow output — and the rest is the detail. `color` takes a tldraw colour name (`black`, `blue`, `red`, `green`, `orange`, `violet`, `grey`) and marks a group, not decoration.

**Arrows are elbows by default.** Pass `"kind": "arc"` only on an arrow that needs the curve.

**Write a reply as its own arrow:** `a -> b` and `b -> a`. The page spreads the anchors of two arrows on one pair, so they draw as two lines with two labels. One arrow labelled with both payloads hides the reply.

## Page faults

The status line names each fault after a build. Each one is a bug in the seed:

| Fault | What it means | The fix |
| --- | --- | --- |
| `crowded` | two boxes sit closer than one gutter | give one of them a different cell |
| `arrow crosses a box` | both elbow routes between the two ends pass through a box | move the two ends onto the same row or column, or move the box out of the way |
| `label on a box` | the label overlaps a box at every placement along its arrow | shorten the label, or shorten the hop |

The page does not check the box between the two ends of a diagonal hop — rule 4 and the picture do.

## The colour protocol

**In a discussion board, colour carries meaning, not grouping** — this overrides the group rule in § The seed. Print this legend to the human every time you hand the board over, and put it on the board as one box in its own cluster `legend`, declared first so it lands on the left. A legend box with no cluster sits at absolute `0,0` and overlaps the first cluster.

| Colour | Who writes it | What it means | Your reply |
| --- | --- | --- | --- |
| black, blue, green | you | the part you believe is settled | leave it |
| orange | you | an open question — the box text is the question | wait for the human to answer it in the box |
| red | the human | wrong, or disputed | change it, or say plainly why you disagree before changing anything |
| violet | the human | something you missed entirely | fold it in; ask what feeds it and what it feeds |
| grey | either | out of scope for this round | leave it, keep it drawn |

**Ask at most three orange questions per round.** A board with ten questions gets answered as prose in chat, and the board stops being the conversation.

**An answer replaces the question text.** The human types over the orange box; you recolour it green when you have folded the answer in.

## Boards that are not a dataflow

- **A decision** — one box per option, arrows from a shared `the choice` box, an orange box for the criterion in dispute.
- **A sequence** — one box per step down a column, arrows carrying what passes between steps.
- **A split** — one cluster per candidate boundary, boxes for what lands on each side; red then means "this belongs on the other side".

**One question per round, one board per question.** A board that answers "which boundary" and "which storage" at once comes back marked in a way neither of you can read.
