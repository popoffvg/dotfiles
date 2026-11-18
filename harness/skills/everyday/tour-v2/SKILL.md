---
name: tour-v2
description: Write a tour of a code change as one TODO page (the problem, a domain map that introduces the terms and links each node to its stops, the map of stops) and a list of comments anchored to line ranges at the tip, then serve both in a local viewer that shows each comment next to its code and opens the line in Zed. Use on "tour-v2", "tour with comments at the code", "walk me through the diff in the viewer", or when the operator wants to read a change stop by stop beside the code. The markdown-only tour, one page per increment, is `tour`.
allowed-tools: Bash(tour:*)
version: 0.4.0
---

# tour-v2

**The product is a folder with two files and a tab in the viewer.** `TODO.md` explains the change before any code. `tour.json` holds the stops: one comment per line range, in reading order. The viewer at http://127.0.0.1:8792/ shows `TODO.md` on the left and the code with the current comment on the right. The `com.vitalii.tour-v2` LaunchAgent keeps it running. Each open tour is one tab; `tour close <folder>` or the × on the tab removes it. The keys `n` and `p` move between stops, and `o` or a click on a line number opens the line in Zed.

## Steps

1. **Pin the change.** Take the base, the tip, and the checkout from the source row in [tour: Sources](../tour/SKILL.md#sources). For the uncommitted working tree, the tip is `worktree` and the base is `HEAD`. Done when you have the base sha, the tip, and the absolute checkout path.
2. **Read the change.** Do step 3 of [tour: Steps](../tour/SKILL.md#steps). Done when you can say in 1 to 3 sentences what goes wrong without the change, with its source.
3. **Draw the domain map.** The map introduces a reader who does not know the domain, and it is the way to move between stops. Write the terms first: each thing the change reads, writes, or reacts to, glossed in one line, with the place it lives. Then draw the map as [Domain map](#domain-map) says. In `TODO.md` the map comes before the terms table: the reader moves by the map and looks a term up. Add a second view from [Views](#views) only when its row matches the change. Draw from the code at the tip, not from the commit messages. Done when every term that a stop title or body uses is in the terms table, every map node names a real thing, and every node that a stop explains links to it.
4. **Cut the stops and order them.** One stop is one line range that one comment explains, at most about 40 lines. Order the stops by call: from the entry point that starts the flow down to the leaves. Mark a stop critical by the rule of [tour: Steps](../tour/SKILL.md#steps) step 4. Done when every changed hunk is in a stop or in "Not on the tour" of `TODO.md`.
5. **Write the folder.** Put it where [tour: Where the folder goes](../tour/SKILL.md#where-the-folder-goes) says, named `tour-v2-<slug>/`. Write `tour.json` first, then `TODO.md`, in the [Layout](#layout) below. Load the `i-have-adhd` skill and apply it to `TODO.md` and to each stop body. Done when `tour check <folder>` prints `0 errors`.
6. **Open it.** Run `tour open <folder>` with the sandbox off: it opens the browser, which the sandbox blocks. It adds the tour as a tab of the running viewer. When it prints "no viewer on port 8792", run the `launchctl kickstart` line it prints. Done when `tour list` shows the folder.
7. **Hand it over.** Tell the operator the URL, the folder path, the problem in one sentence, and the stops in a table: number, title, critical or not. Done when the operator has the URL.

## Domain map

A mermaid `flowchart TD`:

- One `subgraph` per place where things live: a process, a store, a file, an external system. Name it as the reader knows it, for example "Claude Code" or "the notes dir".
- One node per domain thing or actor, named by its term from the terms table. Each edge carries a verb: "runs", "stamps", "reads", "appends to".
- `classDef new` marks the nodes that the change adds or changes. `classDef ctx` marks the untouched neighbors that the reader needs to see where the change fits. Draw at least one `ctx` node.
- At most 12 nodes. A change that needs more gets one overview map of the places, and one map per place under it, each with its own `### Map: <place>` heading.
- `click <node> href "#stop-<n>"` on each node with a stop. The viewer moves to that stop on a click, and marks the node of the current stop.

## Views

Add one of these as a second view when its row matches the change.

| Use the view when the change… | View | Form in `TODO.md` |
|---|---|---|
| adds or changes the states of one object: a job, a PR, a lock, a file | state machine | mermaid `stateDiagram-v2`; each changed transition labeled with its event |
| reacts to events across components | event storm | mermaid `flowchart TD` in the order command → aggregate → event → policy, with one `classDef` color per kind |
| adds or changes calls between components | sequence | mermaid `sequenceDiagram` |
| changes data or an output | before/after | two fenced samples, then a list of the differences |
| changes branch rules | decision table | a table: the conditions, then the result |

## Layout

### `tour.json`

```json
{
  "title": "Retry a failed job three times",
  "repo": "/Users/me/git/app",
  "base": "<base sha>",
  "tip": "<tip sha, or worktree>",
  "stops": [
    {
      "file": "pkg/job/run.go",
      "line": 41,
      "end": 58,
      "node": "job runner",
      "title": "The retry stops after three tries",
      "body": "Markdown. Why the lines do it, the trap, and the rejected way.",
      "critical": true
    }
  ]
}
```

- The array order is the reading order. Stop `n` is the `n`-th element, from 1.
- `file` is relative to `repo`. `line` and `end` are lines at the tip.
- `node` is the term of the domain map node that the stop explains.
- `body` says why, not what. The reader sees the code next to it. Put a fact about other code as a `path:line` at the tip.

### `TODO.md`

```markdown
# <the title from tour.json>

Tip `<sha>` in `<repo>`. Run `tour open <folder>` to open the viewer.

## Problem

<what goes wrong without the change, in 1 to 3 sentences, and its source; "(inferred)" when no source states it>

## Domain

### Map

<the domain map>

### Terms

| Term | What it is | Where it lives |
|---|---|---|
| <term> | <one line> | <the place, with a path:line when it is code> |

### <view name>: <why this view>        (optional)

## Map of stops

| Stop | Node | Title | Critical |
|---|---|---|---|
| [1](#stop-1) | <node> | <title> | **yes**: <what breaks> |

## Not on the tour

- <a hunk outside the purpose of the change, and why>

## Open points

- <slug>: <the question>, or "none"
```

`tour check` fails when a section is missing, a stop range is outside its file at the tip, the map of stops has no `(#stop-n)` link for a stop, or the domain map has no `click … href "#stop-n"` or no node text equal to the `node` of a stop.
