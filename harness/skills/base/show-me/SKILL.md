---
name: show-me
description: Show every running flow as run-order pseudocode, with markers when its steps change. Use when the user asks to see a flow, structure, type, test case, or failure. Route explicitly requested diagrams to drawing skills when they need a canvas.
---

# show-me — one form per kind of content

**The content picks the form, not the size of the system.** Find the row below, draw that form, put one short sentence next to it, and stop.

Show every running path with [Flows](#flows), whether its steps changed or not. Use a diagram row only when the user explicitly asks for a diagram.

## The table

**The user picks the medium first.** When the user names a medium — HTML, a page, an artifact, mermaid, a file — use it, and let the table pick only the shape inside it. A named medium is the reason a routed row needs; do not fall back to an inline block.

**The medium picks diagram syntax.** An explicitly requested diagram in chat is ASCII in a fenced block. A diagram in a markdown file is mermaid — `flowchart`, `sequenceDiagram`, `stateDiagram`. A flow uses pseudocode in either medium.

**A flow diagram runs top to bottom** — mermaid `flowchart TD`, an ASCII flow drawn downward. The file and the chat scroll down and stay narrow, so a left-to-right chain overflows the pane. Left to right only when the user asks for it.

| The content is | Show it as | Done when |
| --- | --- | --- |
| a rule, a branch, an algorithm in code that exists | **pseudocode**, one step per line → `show-code` | the reader can restate the rule without the source; every step that exists carries a clickable trailing `# path:line` |
| a rule before any code exists | **pseudocode** → `show-code`, then `flow-sketch` | every branch, failure cause, and open decision is nameable without the source |
| a running path, with or without changes | **run-order pseudocode** → `show-code`; use [Flows](#flows) | the reader can follow each step from entry to result; changed steps also show their former behavior |
| which function calls which, and in what order | **call tree**, `tree` glyphs → `show-code` | every name is grep-able; path sits as a trailing `# path:line` comment, never on its own line |
| a code path across files that someone will revisit | a **Codemap** → `show-code`, `codelens:codemap` | one question has a pinned, re-anchorable trace |
| the types of a package, or the types a change adds, before review | **lifetime tree** → `show-types` | each type sits at its lifetime level with `new:`, `holds:` and `methods:`, and every review flag is written under the tree |
| one NEW or CHANGED type in that tree | **type card** → `show-types` | every method names what it calls, what it returns, and who calls it |
| which component owns which, and where state sits | **component tree**, owning path on the root | the state hook and the package boundary are both visible |
| responsibility across directories | **shallow file tree**, one comment per dir | each comment says what the dir *owns*, not what it holds |
| a change to any other shape above | **`diff`** over that same shape | the surrounding shape is present and unchanged |
| a shape that is mostly new, or one to copy | **the whole block** | omitting context would hide ownership or order |
| an explicitly requested diagram of conditional branches | **flowchart** | every branch leaves by a labelled edge |
| an explicitly requested diagram of components talking over time | **sequence diagram** | each arrow is a real call, named as the code names it |
| an explicitly requested diagram of states and their moves | **state diagram** | every terminal state is reachable and marked |
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

## Flows

Show one running path per heading. Name its entry point. Write one `python` block from the entry point to its result. Put one step on each line. Indent `if`, `for`, and `with` blocks to show branches, retries, and resource scopes. Use this form without markers when no step changes.

For a changed flow, mark each new step with `# +`. Mark changed behavior with `# ~ was: <before>`. Mark a moved step with `# moved, was: after <step>`. Show a removed step as `# - <step>` on its own line. Leave unchanged steps unmarked. Mark every line of a new path with `# +`. If code exists, add its `path:line` after the marker. Give each unchanged step a trailing `# path:line`.

Show the whole path through 20 lines. For a longer unchanged path, keep its entry, result, branches, and key steps. For a longer changed path, keep each changed line, its enclosing control lines, and one unchanged line on each side. Use `...` for omitted steps. Give each new loop, wait, retry, timer, or background task its own path when a call hides its steps. The [change-review example](../change-review/references/example.md#flow-changes) shows the form.

## Three rules for every form

**The indented forms above are code shapes in both media.** A call tree is `tree` output with `# file:line` comments, a file tree is a directory listing, a component tree is JSX. Each mirrors something that already exists in that shape.

**Cut to the question.** If a row, call, file, prop, or boundary were deleted, would the answer change? If not, it is inventory, not a view. A view the reader must scroll has already failed this — cut rows before shrinking type.

**Say what you did not open**, in one clause under the block. A call tree assembled from names alone is a guess drawn in monospace, and it says so rather than passing as observed. Settling *behaviour* is `with-proof`, not this skill.
