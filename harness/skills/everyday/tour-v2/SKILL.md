---
name: tour-v2
description: Write a tour of a code change as one TODO page (the problem, a domain map that introduces the terms, and each flow that the change touches, with its description, what it did before, what changed, and every step from its trigger to its outcome, with every changed step linked to its stop) and a list of comments anchored to line ranges at the tip, then serve both in a local viewer that shows each comment next to its code and opens the line in Zed. Use on "tour-v2", "tour with comments at the code", "walk me through the diff in the viewer", "which flows does this PR change", or when the operator wants to read a change stop by stop beside the code.
allowed-tools: Bash(tour:*)
version: 0.6.0
---

# tour-v2

**The product is a folder with two files and a tab in the viewer.** `TODO.md` explains the change before any code: the problem, the domain, and each flow the change touches. `tour.json` holds the stops: one comment per line range, in reading order. Each stop is one changed step of one flow. The viewer at http://127.0.0.1:8792/ shows `TODO.md` on the left and the code with the current comment on the right. It marks the flow step of the current stop. The `com.vitalii.tour-v2` LaunchAgent keeps it running. Each open tour is one tab; `tour close <folder>` or the × on the tab removes it. The keys `n` and `p` move between stops, and `o` or a click on a line number opens the line in Zed.

A **flow** is one path through the system: a trigger starts it, it runs a chain of steps across components, and it ends in an outcome at the system edge. Examples: "the CLI command `deploy` runs", "a webhook arrives", "the server starts".

## Steps

1. **Pin the change.** Take the base and the tip from the row of [Sources](#sources). Done when you have the base sha, the tip, and the absolute checkout path.
2. **Read the change.** Read every changed source file in full at the tip, and the hunks of each file that existed at the base. List every output the change adds or changes at the system edge: data in a store, an API request or response, a CLI output, a file, an event, a log line. Read the reason for the change from its source in [Sources](#sources). Done when you can say in 1 to 3 sentences what goes wrong without the change, with its source, or with "(inferred)" when no source states it.
3. **Find the flows.** For each changed function, follow its callers up to the entry point: a `main`, a CLI command, an HTTP or RPC handler, a hook, a scheduled job, an event consumer. Each different entry point starts one flow. Also follow each changed function down to the edge output it builds. Name each flow by its trigger, in the words of the reader. A flow that the change adds has only new steps. A flow that the change deletes has only removed steps. Done when every changed hunk is on a step of a flow, or goes to "Not on the tour" with its reason.
4. **Draw the domain map.** The map introduces a reader who does not know the domain. Write the terms first: each thing the flows read, write, or react to, glossed in one line, with the place it lives. Then draw the map as [Domain map](#domain-map) says. In `TODO.md` the map comes before the terms table. Add a second view from [Views](#views) only when its row matches the change. Draw from the code at the tip, not from the commit messages. Done when every term that a flow step or a stop uses is in the terms table, and every map node names a real thing.
5. **Write each flow in full, and cut the stops.** Write each flow as [Flows](#flows) says: every step from the trigger to the outcome, the unchanged steps too. Each changed step links to its stop. One stop is one line range that one comment explains, at most about 40 lines. Order the stops flow by flow, in the order of the flows table, and inside a flow in step order. A stop on code that two flows share belongs to the first flow; a step of the later flow links to the same stop. Mark a stop critical when a wrong line in it loses or corrupts data, breaks a contract that a user or an external client reads, races, or opens a security gap. A rename, a move, or a config value is not critical. Done when every changed step of every flow links to a stop.
6. **Write the folder.** Put it where [Where the folder goes](#where-the-folder-goes) says. Write `tour.json` first, then `TODO.md`, in the [Layout](#layout) below. Apply the ASD-STE100 rules (`~/.claude/rules/language.md`) to `TODO.md` and to each stop body. Done when `tour check <folder>` prints `0 errors`.
7. **Open it.** Run `tour open <folder>` with the sandbox off: it opens the browser, which the sandbox blocks. It adds the tour as a tab of the running viewer. When it prints "no viewer on port 8792", run the `launchctl kickstart` line it prints. Done when `tour list` shows the folder.
8. **Hand it over.** Tell the operator the URL, the folder path, the problem in one sentence, and the flows in a table: flow, before, change, stops, critical stops. Done when the operator has the URL.

## Sources

With no source named, take the working tree, and the branch when the working tree is clean.

| Source | Base and tip | Reason for the change |
|---|---|---|
| a PR (`#2339`, a URL) | `gh pr view <n> --json baseRefOid,headRefOid`; check out the head | the PR body, the linked issue, the review comments |
| a branch | `git merge-base <default branch> <branch>`, and the branch head | the commit messages, the PR of the branch |
| a commit or a range | the parent of the commit, or the two ends of the range | the commit messages |
| the working tree | `HEAD`; the tip is `worktree` | the request in this session, the notes dir |
| a wm TODO | the first and last commit of the TODO | the TODO Outcome, the spec, the ADRs it cites |

## Where the folder goes

| Case | Folder |
|---|---|
| a wm TODO under review | `<notes-dir>/review/TODO-N/tour-v2/` |
| a repo with `.notes/` | `.notes/tour-v2-<slug>/` |
| anything else | `<scratchpad>/tour-v2-<slug>/` |

`<slug>` is the change in 2 to 4 kebab-case words.

## Domain map

A mermaid `flowchart TD`:

- One `subgraph` per place where things live: a process, a store, a file, an external system. Name it as the reader knows it, for example "Claude Code" or "the notes dir".
- One node per domain thing or actor, named by its term from the terms table. Each edge carries a verb: "runs", "stamps", "reads", "appends to".
- `classDef new` marks the nodes that the change adds or changes. `classDef ctx` marks the untouched neighbors that the reader needs to see where the change fits. Draw at least one `ctx` node.
- At most 12 nodes. A change that needs more gets one overview map of the places, and one map per place under it, each with its own `### Map: <place>` heading.
- `click <node> href "#stop-<n>"` on each node with a stop, to the first stop of that node. The viewer moves to that stop on a click, and marks the node of the current stop.

## Flows

`## Flows` starts with a table of the flows, then has one `### Flow: <name>` section per flow. The name is the `flow` of its stops in `tour.json`, letter for letter.

Each flow section has, in this order:

- **Description:** what the flow does for its user, in one sentence. The same sentence goes in the "What it does" cell of the flows table.
- **Trigger:** what starts the flow, with the entry point as `path:line`.
- **Before:** what the flow did at the base, seen at the system edge, in 1 or 2 sentences. For a new flow, write "the flow did not exist", and what the user did instead.
- **Change:** what the change makes the flow do differently, in 1 or 2 sentences, and the outcome at the system edge after the change. For a removed flow, say what replaces it.
- **Steps:** a numbered list of the whole flow, from the trigger to the outcome. One step is one line: the actor, the verb, the object, and its `path:line` at the tip. Use the terms of the domain map.
  - An unchanged step is plain text. Join a run of unchanged steps that the reader does not need into one step, for example "3 calls that parse the flags, unchanged".
  - A changed step starts with its kind (**new**, **changed**, or **removed**) and its stop link `[stop <n>](#stop-<n>)`. A **changed** step ends with "Before: <what the step did at the base>". A **removed** step gives its `path:line` at the base.
  - A critical stop adds "**critical**: <what breaks>" to its step.

Add a mermaid `sequenceDiagram` under the steps only when the flow crosses more than two places.

## Views

Add one of these as a second view when its row matches the change.

| Use the view when the change… | View | Form in `TODO.md` |
|---|---|---|
| adds or changes the states of one object: a job, a PR, a lock, a file | state machine | mermaid `stateDiagram-v2`; each changed transition labeled with its event |
| reacts to events across components | event storm | mermaid `flowchart TD` in the order command → aggregate → event → policy, with one `classDef` color per kind |
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
      "flow": "job runs",
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
- `flow` is the name of the `### Flow:` section whose step links to this stop.
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

## Flows

| Flow | What it does | Stops |
|---|---|---|
| job runs | runs one due job and stores its result | [1](#stop-1), [2](#stop-2) |

### Flow: job runs

**Description:** runs one due job and stores its result.
**Trigger:** the scheduler picks the next due job, `pkg/sched/loop.go:30`.
**Before:** a job that failed once ended `failed`, and its log had only the last error.
**Change:** a failed job runs again up to three times, then ends `failed`. The job log keeps one line per try.

1. The scheduler loop takes the next due job, `pkg/sched/loop.go:30`.
2. **changed** [stop 1](#stop-1) The job runner retries a failed try up to three times, `pkg/job/run.go:41`. Before: it ran the job once. **critical**: a fourth try charges the customer twice.
3. **new** [stop 2](#stop-2) The job runner writes each try to the job log, `pkg/job/log.go:12`.
4. The scheduler stores the final job state, `pkg/sched/store.go:88`.

## Not on the tour

- <a hunk outside the purpose of the change, and why>

## Open points

- <slug>: <the question>, or "none"
```

`tour check` fails when a section is missing, a stop range is outside its file at the tip, a flow section has no `**Description:**`, `**Trigger:**`, `**Before:**`, or `**Change:**` line, a stop has no `### Flow:` section for its `flow` or that section has no `(#stop-n)` link for it, or the domain map has no `click … href "#stop-n"` or no node text equal to the `node` of a stop.
