---
name: show-me
description: Pick the form for anything shown to the user and draw it — a flow, a rule, a call order, a code path, the types of a package or a change, a test case, a failure, a structure, or a comparison. Use when the user asks to see, show, or draw something, in chat or in an md file. Route explicitly requested diagrams to drawing skills when they need a canvas.
---

# show-me — one form per kind of content

**The content picks the form, not the size of the system.** Find the row in the table, open the reference it names, draw that form, put one short sentence next to it, and stop.

## Pick the medium

1. **The environment picks the medium.** Content in the chat stays in the chat. Content that leaves the chat goes out through `agent-to-user`: its environment row gives the medium and the figure forms in it. The table picks only the shape inside that medium.
2. **The medium picks diagram syntax.** An explicitly requested diagram in chat is ASCII in a fenced block. A diagram outside the chat takes the figure form of the environment row in `agent-to-user`. A flow uses pseudocode in every medium.
3. **A flow diagram runs top to bottom** — mermaid `flowchart TD`, an ASCII flow drawn downward. The file and the chat scroll down and stay narrow, so a left-to-right chain overflows the pane. Left to right only when the user asks for it.

Use a diagram row only when the user explicitly asks for a diagram.

## The table

| The content is | Show it as | Reference | Done when |
| --- | --- | --- | --- |
| a running path, with or without changes | **run-order pseudocode** | [show-code: Flows](references/show-code.md#flows) | the reader can follow each step from entry to result; changed steps also show their former behavior |
| a rule, a branch, an algorithm in code that exists | **pseudocode**, one step per line | [show-code: Pseudocode](references/show-code.md#pseudocode) | the reader can restate the rule without the source; every step that exists carries a clickable trailing `# path:line` |
| a rule before any code exists | **pseudocode** | [show-code: Pseudocode](references/show-code.md#pseudocode) | every branch, failure cause, and open decision is nameable without the source |
| a race: two or more actors at the same time, where the order of their steps causes the result | **interleaving timeline**, one column per actor | [show-code: Interleaving](references/show-code.md#interleaving) | each tick moves one actor, each code step has a `path:line`, and the last row is the end state that breaks the rule |
| which function calls which, and in what order | **call tree**, `tree` glyphs | [show-code: Call tree](references/show-code.md#call-tree) | every name is grep-able; path sits as a trailing `# path:line` comment, never on its own line |
| the components a change touches, or which component owns which | **component tree**, one per package | [show-code: Component tree](references/show-code.md#component-tree) | every component has its brick, part, and role, and every public member names its caller |
| the types of a package, or the types a change adds, before review | **lifetime tree** | [show-types: Lifetime tree](references/show-types.md#lifetime-tree) | each type sits at its lifetime level with `new:`, `holds:` and `methods:`, and every review flag is written under the tree |
| one NEW or CHANGED type in that tree | **type card** | [show-types: Type card](references/show-types.md#type-card) | every method names what it calls, what it returns, and who calls it |
| a test case, or a set of cases | **Gherkin** scenario | [show-cases: Test cases](references/show-cases.md#test-cases) | every `Then` is a check a test can run |
| a set of unit cases that vary the same inputs | **Gherkin** `Scenario Outline`, one `Examples` row per case | [show-cases: Pairwise cases](references/show-cases.md#pairwise-cases) | every row sets every input, and every row has a name |
| a failure — a bug, a failing test, a review finding | **Gherkin** scenario, actual result under the `Then` | [show-cases: Failures](references/show-cases.md#failures) | the scenario replays the failure, and the reader sees expected against actual |
| responsibility across directories | **shallow file tree**, one comment per dir | — | each comment says what the dir *owns*, not what it holds |
| a change to any other shape above | **`diff`** over that same shape | — | the surrounding shape is present and unchanged |
| a shape that is mostly new, or one to copy | **the whole block** | — | omitting context would hide ownership or order |
| an explicitly requested diagram of conditional branches | **flowchart** | — | every branch leaves by a labelled edge |
| an explicitly requested diagram of components talking over time | **sequence diagram** | — | each arrow is a real call, named as the code names it |
| an explicitly requested diagram of states and their moves | **state diagram** | — | every terminal state is reachable and marked |
| conditions that combine | **decision table**, one row per combination | — | no combination is missing a row |
| options being weighed | **comparison table**, one row per option | — | every column is a dimension that changed someone's mind |
| numbers, series, distributions | a chart | `dataviz` | — |
| data at rest and payloads in flight | an interactive diagram | `dataflow` | — |
| layout, spacing, a colour or state comparison | a rendered SVG | `mictx:svg-diagram` | — |
| boxes the human wants to move | an interactive Artifact | `dataflow` | — |
| boxes the human must hand-place and keep positioned across sessions | a live board | `board` | — |
| a design the human must mark up | a board plus rounds | `board` § The round | — |
| a batch of choices, or a handoff the human reads cold and answers | an editable file | `to-user` | — |
| the current decision and picture of the work, read cold, with no answer | a snapshot file | `snapshot` | — |
| a corpus someone must learn | lessons or a deck | `lessons`, `deck-as-code` | — |

**The bold forms are fenced blocks in the reply** and answer most questions. A row that names a `references/` file is still an inline block: open that file before you draw. It holds the rules and the worked example of the form.

**A row that names another skill costs a canvas, a browser, or a publish**, and is done when that skill is done. Take it only by naming what the inline form could not carry: pixels, motion, the human's hands, or a page of its own.

## Three rules for every form

**The indented forms are code shapes in both media.** A call tree is `tree` output with `# file:line` comments, a file tree is a directory listing, a component tree is a package listing with `# OWNS` on each root. Each mirrors something that already exists in that shape.

**Cut to the question.** If a row, call, file, prop, or boundary were deleted, would the answer change? If not, it is inventory, not a view. A view the reader must scroll has already failed this — cut rows before shrinking type.

**Say what you did not open**, in one clause under the block. A call tree assembled from names alone is a guess drawn in monospace, and it says so rather than passing as observed. Settling *behaviour* is `with-proof`, not this skill.
