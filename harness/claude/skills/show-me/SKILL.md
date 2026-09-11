---
name: show-me
description: Pick the form that fits what is being shown — pseudocode, a call tree, a Codemap, a component tree, a file tree, a diff, a decision table, a flow diagram (mermaid in md files, ASCII in chat) — and write it into the reply. Use when the user says "show me", "draw it", "sketch that", "what does the flow look like", "where does that live", when a design point is easier pointed at than described, or when prose has grown into a third paragraph about structure. Routes to the drawing skills when the content needs a canvas.
---

# show-me — one form per kind of content

**The content picks the form, not the size of the system.** Find the row below, draw that form, put one short sentence next to it, and stop.

## The table

| The content is | Show it as | Done when |
| --- | --- | --- |
| a rule, a branch, an algorithm in code that exists | **pseudocode**, one step per line | the reader can restate the rule without the source; every step that exists carries a clickable trailing `# path:line` |
| a rule or flow before any code exists | **pseudocode** → `flow-sketch` | every branch, failure cause, and open decision is nameable without the source |
| which function calls which, and in what order | **call tree**, `tree` glyphs | every name is grep-able; path sits as a trailing `# path:line` comment, never on its own line |
| a code path across files that someone will revisit | a **Codemap** → `codelens` | one question has a pinned, re-anchorable trace |
| which component owns which, and where state sits | **component tree**, owning path on the root | the state hook and the package boundary are both visible |
| responsibility across directories | **shallow file tree**, one comment per dir | each comment says what the dir *owns*, not what it holds |
| a change to any shape above | **`diff`** over that same shape | the surrounding shape is present and unchanged |
| a shape that is mostly new, or one to copy | **the whole block** | omitting context would hide ownership or order |
| a path that forks on a condition | **flowchart** | every branch leaves by a labelled edge |
| two components talking over time | **sequence diagram** | each arrow is a real call, named as the code names it |
| states and the moves between them | **state diagram** | every terminal state is reachable and marked |
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

## Pseudocode

One step per line, indentation for nesting, the code's own names, no language syntax — no braces, no types, no `await`.

**A step the code already has carries a trailing reference; a step being proposed carries none.** The blank right column is what tells the reader which half of the rule is written. Write the reference as a repo-relative path plus line — `src/session/save.ts:94` — which is the form a Zed terminal turns into a click. A bare basename is not clickable; an absolute path is noise. Name the root once above the block when the paths are long.

```text
on save(content)                            # src/session/save.ts:88
  if content is unchanged since last write  # src/session/save.ts:94
    return the cached result                # src/session/cache.ts:31
  write the new content                     # src/session/save.ts:101
  invalidate the cache entry
  return the fresh result
```

Here the last two lines are the change: the cache is read today and never invalidated.

A `flow-sketch` carries no references at all: nothing is written yet, so there is nothing to click.

## Call tree

Names are the tree. Location is metadata: a trailing `# path:line` aligned to the right, clickable and rooted as in **Pseudocode** above, shortened against a root named once under the block. A path on its own line is too loud — the reader came for the calls.

```
# under src/variants/
process_one                                            # build_variants.py:81
├── build_candidates_and_declines                      # variant_candidates.py:374
│   ├── admitted_targets                               # variant_candidates.py:201
│   └── _scored_dropping_blockers                      # variant_candidates.py:310
│       └── _cleared_candidate                         # variant_candidates.py:243
└── rank_variants                                      # variant_ranking.py:152
```

Two roots (a later pass, a second entry) are two trees, not one stretched trunk.

## Code traces that survive the reply

Use a Codemap only for a code path across files that someone will revisit. `codelens` writes `docs/traces/<slug>.codemap.md`, walks its real code locations, and later re-anchors them with `codelens check`.

```markdown
# how a save reaches the cache or the disk
@ <short commit>
> src/session/save.ts:88 save

- the content is unchanged since the last write
  - src/session/save.ts:94 isUnchanged
    - src/session/cache.ts:31 cachedResult
      | the entry is read here and invalidated nowhere
- the content changed
  - src/session/save.ts:101 writeContent
```

Same flow as **Pseudocode** above, same locations as a **call tree** — the step names carry the rule, the nesting carries the calls, and the pin makes both re-checkable months later.

`#` is the question, `@` the commit pin, `>` an entry point, `-` a stage or `path:line:symbol` Node, and `|` a fact the code alone does not say. Indentation means part of the current step, not necessarily a direct call; expand a location once and repeat it bare thereafter.

## Three rules for every form

**The medium picks the flow syntax.** A flow written into a markdown file is mermaid — `flowchart`, `sequenceDiagram`, `stateDiagram`. A flow shown in the chat reply to the user is an ASCII diagram in a fenced block — arrows and boxes in monospace — because chat renders no mermaid. The indented forms above are code shapes in both media: a call tree is `tree` output with `# file:line` comments, a file tree is a directory listing, a component tree is JSX. Each mirrors something that already exists in that shape.

**Cut to the question.** If a row, call, file, prop, or boundary were deleted, would the answer change? If not, it is inventory, not a view. A view the reader must scroll has already failed this — cut rows before shrinking type.

**Say what you did not open**, in one clause under the block. A call tree assembled from names alone is a guess drawn in monospace, and it says so rather than passing as observed. Settling *behaviour* is `with-proof`, not this skill.
