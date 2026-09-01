---
name: dataflow
description: Draw how data moves between the coarse components of a system — repositories, in-memory stores, files, and outbound API calls — as an editable tldraw diagram. Use when the user says "dataflow", "how does data flow", "where does this data come from", "draw the data path", "diagram how X reaches Y", or asks how state moves between services. Answers with a picture the user can then rearrange by hand.
---

# Dataflow

**A dataflow diagram answers one question: what data moves, and who holds it between moves.**
Not the call graph, not the class diagram. Every arrow carries a named payload; every box owns
data at rest. If an arrow has no payload to write on it, it is a call, not a dataflow, and it
does not belong.

Draw with the `tldraw-live-diagram` skill — it owns the seed format, the grid, and the spacing.
This skill owns only what counts as a box and what counts as an arrow.

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
4. **Name the payload on every hop.** Walk each entry point to the storage it reaches and write
   what actually travels: `user id`, `raw csv rows`, `signed url`. An unnamed arrow means you
   have not read the code yet — go read it.
5. **Lay out per service.** One service per column band, its entry points on top and its
   outbound calls at the bottom, so data reads downward. Leave one empty column between two
   services.
6. **Connect the services.** A call from service A to service B is one arrow from A's api-call
   box to B's entry-point box, labelled with the payload. This is the only kind of arrow that
   crosses a band.
7. **Draw it** with `tldraw-live-diagram`, then tell the user the port so they can move the
   boxes.

## Read the code, then say what you could not find

State every gap out loud: a repository whose writer you never found, an arrow whose payload you
guessed, a service you saw only from the caller's side. A dataflow diagram that hides a guess is
worse than no diagram, because the reader trusts the picture over the code.

**Before concluding a component does not exist, run the same search for one you know does.** A
grep that matches nothing looks exactly like a grep that cannot see anything.
