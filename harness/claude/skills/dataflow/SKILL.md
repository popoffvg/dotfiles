---
name: dataflow
description: Draw how data moves between the coarse components of a system — repositories, in-memory stores, files, and outbound API calls — as an interactive Artifact the user can drag, pan and zoom. Use when the user says "dataflow", "how does data flow", "where does this data come from", "draw the data path", "diagram how X reaches Y", or asks how state moves between services.
---

# Dataflow

**A dataflow diagram answers one question: what data moves, and who holds it between moves.**
Not the call graph, not the class diagram. Every arrow carries a named payload; every box owns
data at rest. If an arrow has no payload to write on it, it is a call, not a dataflow, and it
does not belong.

This skill owns what counts as a box and what counts as an arrow.

## Draw it as an Artifact

**Publish an interactive Artifact — load the `artifact-design` skill first, as that tool requires.**
Hold the boxes and arrows as data in the page and compute the routing in JavaScript, so a box the
reader drags takes its arrows with it. That is the whole reason this beats the alternatives: a
rendered picture bakes its routes, so every layout complaint becomes a layout fight, and a
hand-placed grid makes you the layout engine.

What the page owes its reader:

- **Drag a box, pan the canvas, zoom to the cursor.** Plus a fit-to-view control, because a real
  dataflow is wider than a screen.
- **Colour marks the service, shape marks the kind.** Two axes, two channels — colour alone can
  only carry one, and the five kinds are the half a reader keeps asking about.
- **Selecting a box colours what arrives at it differently from what leaves it**, and dims the
  rest. Direction is the question a reader brings to a hub, and one accent for both answers it
  half. Semantic direction colours are their own pair, never the page accent.
- **A payload list for the selected box**, in the same two colours as the canvas, so the rail and
  the picture agree.

The strict Artifact CSP blocks every external host, so no diagram library, no font CDN, no WASM
from a CDN. Vanilla SVG and one `<script>` is the whole budget, and it is enough.

**Reach for `tldraw-live-diagram` only when the human must hand-place the boxes** and keep those
positions — it owns a seed format, a grid, and a live editor that writes back to disk. It costs a
local server and a browser, and it makes you responsible for crossings and label collisions.

## A component is a thing that holds or crosses data

**Only these five kinds are boxes.** Anything smaller is detail inside a box.

| Kind | It is | Example |
| --- | --- | --- |
| repository | durable storage behind an interface | `UserRepository`, a table, a bucket |
| in-memory store | state alive only while the process runs | a cache, a registry, a session map |
| file | a path on disk read or written directly | `work.settings.json`, a log |
| api call | a request leaving this system | Stripe charge, an LLM completion |
| entry point | where data enters from outside | an HTTP handler, a CLI command, a queue consumer |

**A service is a group of boxes, never a box.** One service becomes a band of columns; the
boxes inside it are its own repositories, stores, files, and outbound calls.

Reject anything else. A helper, a formatter, a validator, a controller — these transform data
in flight and belong in the arrow's label, not on the canvas. The test: **if it were deleted,
would some data have nowhere to live?** No means it is not a component.

## Steps

1. **Find the entry points.** Where does data come in — handlers, commands, consumers? Each is
   a box in the top row.
2. **Find the resting places.** Search for repositories, caches, and file reads and writes.
   Each is a box. Name the box after the thing, and put what it holds on the second line.
3. **Find the outbound calls.** Every request leaving the process is a box in the bottom row.
4. **Name the payload on every hop, in a few words.** Walk each entry point to the storage it
   reaches and write what actually travels: `user id`, `raw csv rows`, `signed url`. An unnamed
   arrow means you have not read the code yet — go read it. Keep it to a noun phrase: the label
   sits at the arrow's midpoint, so a clause lands on whatever box is in the way, and that alone
   makes a diagram unreadable before anything else about it is wrong.
5. **One cluster per service.** Give each service a `cluster` so it draws as a titled frame that
   drags as one thing; `row` and `col` inside it are cluster-local.
6. **Rows are the kind of box, not a free choice.** Entry points on the top row, the things data
   rests in below them, requests leaving the system on the bottom row — so data reads downward in
   every cluster. A band holding more than three boxes takes a second row rather than spilling
   sideways, which is also what keeps a hub's arrows short.
7. **Connect the services.** A call from service A to service B is one arrow from A's api-call box
   to B's entry-point box, labelled with the payload. This is the only kind of arrow that crosses
   a band, so put those two boxes on the facing edges of their clusters.
8. **Place to avoid crossings, then read the report.** Two boxes that talk belong on the same row
   or the same column; an elbow arrow routes around a box only when a corner is free. The page
   names every arrow that cuts through a third box and every label that lands on one — each is a
   placement bug, fixed by moving a box.
9. **Publish it** as an Artifact per the section above, and say the one thing the picture cannot:
   what you could not find in the code.

## A hub is what makes a dataflow unreadable

One box that touches five others cannot reach them all along an axis: a cell has four sides, so
the fifth arrow goes diagonal and cuts a corner box. When the report names crossings that all
share one endpoint, the layout is not the problem — that box is.

Three ways out, in the order to try them:

1. **Give its band a second row**, so its partners sit around it instead of in a line.
2. **Split the hub** when it is really two responsibilities sharing a name — an entry point that
   also stores state is two boxes.
3. **Accept the crossing and say which one.** A residual crossing on a cross-cluster return arrow
   is cheaper than a layout contorted to remove it. Name the crossings you left, the same way you
   name a payload you had to guess.

## Read the code, then say what you could not find

State every gap out loud: a repository whose writer you never found, an arrow whose payload you
guessed, a service you saw only from the caller's side. A dataflow diagram that hides a guess is
worse than no diagram, because the reader trusts the picture over the code.

**Before concluding a component does not exist, run the same search for one you know does.** A
grep that matches nothing looks exactly like a grep that cannot see anything.
