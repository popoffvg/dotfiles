---
name: discussion-scheme
description: Hold a design discussion on a live tldraw board instead of in prose — draw the current understanding, hand the board to the human to mark up, read their marks back, redraw. Use when the user says "let's discuss the design/architecture on a board", "draw it and I'll fix it", "discuss the scheme", "let's agree on the structure visually", when a design disagreement is easier pointed at than described, or when a plan needs the human's edits before any code is written.
---

# Discussion scheme

**The board is the conversation.** Every round: you draw what you believe, the human marks the board, you read the marks and redraw. The discussion is over when the board comes back with no red on it.

Mechanics of drawing, seeds, clusters, arrows and spacing: read `tldraw-live-diagram` first. This skill adds only the turn-taking and the mark-up protocol on top of those scripts.

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

**In a discussion board, colour carries meaning, not grouping** — this overrides the `tldraw-live-diagram` rule that colour marks a group. Print this legend to the human every time you hand the board over, and put it on the board as a box in the top-left cell.

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
