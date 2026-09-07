---
name: show-me
description: Pick the form that fits what is being shown — pseudocode, a call tree, a component tree, a file tree, a diff, a decision table, a mermaid flow — and write it into the reply. Use when the user says "show me", "draw it", "sketch that", "what does the flow look like", "where does that live", when a design point is easier pointed at than described, or when prose has grown into a third paragraph about structure. Routes to the drawing skills when the content needs a canvas.
---

# show-me — one form per kind of content

**The content picks the form, not the size of the system.** Find the row below, draw that form, put one short sentence next to it, and stop.

## The table

| The content is | Show it as | Done when |
| --- | --- | --- |
| a rule, a branch, an algorithm | **pseudocode** | the reader can restate the rule without the source |
| which function calls which, and in what order | **call tree**, indented | every name is one the reader can grep |
| which component owns which, and where state sits | **component tree**, owning path on the root | the state hook and the package boundary are both visible |
| responsibility across directories | **shallow file tree**, one comment per dir | each comment says what the dir *owns*, not what it holds |
| a change to any shape above | **`diff`** over that same shape | the surrounding shape is present and unchanged |
| a shape that is mostly new, or one to copy | **the whole block** | omitting context would hide ownership or order |
| a path that forks on a condition | **mermaid `flowchart`** | every branch leaves by a labelled edge |
| two components talking over time | **mermaid `sequenceDiagram`** | each arrow is a real call, named as the code names it |
| states and the moves between them | **mermaid `stateDiagram`** | every terminal state is reachable and marked |
| conditions that combine | **decision table**, one row per combination | no combination is missing a row |
| options being weighed | **comparison table**, one row per option | every column is a dimension that changed someone's mind |
| numbers, series, distributions | a chart → `dataviz` | — |
| data at rest and payloads in flight | an interactive diagram → `dataflow` | — |
| layout, spacing, a colour or state comparison | a rendered SVG → `svg-diagram` | — |
| boxes the human wants to move | an interactive Artifact → `dataflow` | — |
| boxes the human must hand-place and keep positioned across sessions | a live board → `tldraw-live-diagram` | — |
| a design the human must mark up | a board plus rounds → `discussion-scheme` | — |
| a batch of choices the human must answer | an editable file → `to-user` | — |
| a corpus someone must learn | lessons or a deck → `lessons`, `deck-as-code` | — |

The bold forms are fenced blocks in the reply and answer most questions. A routed row costs a canvas, a browser, or a publish, and is done when the skill it names is done — that skill states its own criterion. **Take a routed row only by naming what the inline form could not carry: pixels, motion, the human's hands, or a page of its own.**

## Three rules for every form

**A flow is mermaid.** `flowchart`, `sequenceDiagram`, `stateDiagram` — never arrows and boxes drawn in monospace. The indented forms above are code shapes: a call tree is a stack trace, a file tree is a directory listing, a component tree is JSX. Each mirrors something that already exists in that shape.

**Cut to the question.** If a row, call, file, prop, or boundary were deleted, would the answer change? If not, it is inventory, not a view. A view the reader must scroll has already failed this — cut rows before shrinking type.

**Say what you did not open**, in one clause under the block. A call tree assembled from names alone is a guess drawn in monospace, and it says so rather than passing as observed. Settling *behaviour* is `with-proof`, not this skill.
