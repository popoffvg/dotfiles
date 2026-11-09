---
name: show-me
description: Pick the form that fits what is being shown — pseudocode, a call tree, a Codemap, a component tree, a lifetime tree and type cards for type design, Gherkin scenarios for test cases and failures, a file tree, a diff, a decision table, a flow diagram (mermaid in md files, ASCII in chat) — and write it into the reply. Use when the user says "show me", "draw it", "sketch that", "what does the flow look like", "where does that live", "show me the types", "review the type design", "show the test cases", "describe the failure", when a design point is easier pointed at than described, or when prose has grown into a third paragraph about structure. Routes to the drawing skills when the content needs a canvas.
---

# show-me — one form per kind of content

**The content picks the form, not the size of the system.** Find the row below, draw that form, put one short sentence next to it, and stop.

## The table

**The medium picks the syntax before the table picks the form.** A flow shown in the chat reply to the user is an ASCII diagram in a fenced block — arrows and boxes in monospace — because chat renders no mermaid. A flow written into a markdown file is mermaid — `flowchart`, `sequenceDiagram`, `stateDiagram`.

**A flow diagram runs top to bottom** — mermaid `flowchart TD`, an ASCII flow drawn downward. The file and the chat scroll down and stay narrow, so a left-to-right chain overflows the pane. Left to right only when the user asks for it.

| The content is | Show it as | Done when |
| --- | --- | --- |
| a rule, a branch, an algorithm in code that exists | **pseudocode**, one step per line → `show-code` | the reader can restate the rule without the source; every step that exists carries a clickable trailing `# path:line` |
| a rule or flow before any code exists | **pseudocode** → `show-code`, then `flow-sketch` | every branch, failure cause, and open decision is nameable without the source |
| which function calls which, and in what order | **call tree**, `tree` glyphs → `show-code` | every name is grep-able; path sits as a trailing `# path:line` comment, never on its own line |
| a code path across files that someone will revisit | a **Codemap** → `show-code`, `codelens:codemap` | one question has a pinned, re-anchorable trace |
| the types of a package, or the types a change adds, before review | **lifetime tree** → `show-types` | each type sits at its lifetime level with `new:`, `holds:` and `methods:`, and every review flag is written under the tree |
| one NEW or CHANGED type in that tree | **type card** → `show-types` | every method names what it calls, what it returns, and who calls it |
| which component owns which, and where state sits | **component tree**, owning path on the root | the state hook and the package boundary are both visible |
| responsibility across directories | **shallow file tree**, one comment per dir | each comment says what the dir *owns*, not what it holds |
| a change to any shape above | **`diff`** over that same shape | the surrounding shape is present and unchanged |
| a shape that is mostly new, or one to copy | **the whole block** | omitting context would hide ownership or order |
| a path that forks on a condition | **flowchart** | every branch leaves by a labelled edge |
| two components talking over time | **sequence diagram** | each arrow is a real call, named as the code names it |
| states and the moves between them | **state diagram** | every terminal state is reachable and marked |
| a test case, or a set of cases | **Gherkin** scenario → `show-cases` | every `Then` is a check a test can run |
| a failure — a bug, a failing test, a review finding | **Gherkin** scenario, actual result under the `Then` → `show-cases` | the scenario replays the failure, and the reader sees expected against actual |
| conditions that combine | **decision table**, one row per combination | no combination is missing a row |
| options being weighed | **comparison table**, one row per option | every column is a dimension that changed someone's mind |
| numbers, series, distributions | a chart → `dataviz` | — |
| data at rest and payloads in flight | an interactive diagram → `dataflow` | — |
| layout, spacing, a colour or state comparison | a rendered SVG → `mictx:svg-diagram` | — |
| boxes the human wants to move | an interactive Artifact → `dataflow` | — |
| boxes the human must hand-place and keep positioned across sessions | a live board → `board` | — |
| a design the human must mark up | a board plus rounds → `board` § The round | — |
| a batch of choices, or a handoff the human reads cold and answers | an editable file → `to-user` | — |
| the current decision and picture of the work, read cold, with no answer | a snapshot file → `snapshot` | — |
| a corpus someone must learn | lessons or a deck → `lessons`, `deck-as-code` | — |

The bold forms are fenced blocks in the reply and answer most questions. **A row that names `show-code`, `show-types`, or `show-cases` is still an inline block: load that worker before you draw.** It holds the rules and the worked example of the form. Any other routed row costs a canvas, a browser, or a publish, and is done when the skill it names is done — that skill states its own criterion. **Take a routed row only by naming what the inline form could not carry: pixels, motion, the human's hands, or a page of its own.**

## Three rules for every form

**The indented forms above are code shapes in both media.** A call tree is `tree` output with `# file:line` comments, a file tree is a directory listing, a component tree is JSX. Each mirrors something that already exists in that shape.

**Cut to the question.** If a row, call, file, prop, or boundary were deleted, would the answer change? If not, it is inventory, not a view. A view the reader must scroll has already failed this — cut rows before shrinking type.

**Say what you did not open**, in one clause under the block. A call tree assembled from names alone is a guess drawn in monospace, and it says so rather than passing as observed. Settling *behaviour* is `with-proof`, not this skill.
