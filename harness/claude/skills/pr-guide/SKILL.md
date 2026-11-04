---
name: pr-guide
description: Write a reading guide for a code change, as a folder of markdown pages the operator reads next to the code. It holds a README with one figure of the whole change and the reading order, then one page per concern with the code paths as mermaid flows, the deviations from what was approved, and a table of the tests that prove each behavior. Use on "guide me through the changes", "create md docs for the diff", "walk me through this branch", "review guide", or before the operator reads a diff for an approve verdict. A file that asks for a verdict is `to-user`; the state of the work, not the code, is `snapshot`.
allowed-tools: Bash(~/.claude/scripts/open-file.sh:*)
version: 0.3.0
---

# pr-guide

**The operator reads the guide with the code open beside it.** The guide does not replace the diff. It gives the order to read the diff in, what each part does and why, and which test proves it. It asks nothing, so it has no `Answer:` slot. A point that needs a verdict goes to a `to-user` file, and the guide links to it.

## Steps

1. **Pin the change.** Find the base and the tip commit, the branch, and the checkout. Run `git diff --stat <base> <tip>`. Done when you have the tip sha, which every `file:line` in the guide points to.
2. **Read every changed source file in full at the tip.** Read the diff hunks of the files that existed before. Read the test files by their `func Test` and `t.Run` names, and open a test body only when its name does not say what it proves. Done when you can name, for each changed function, its callers in the diff and the test that covers it.
3. **Cut the change into concerns, not files.** A concern is one question the code answers, for example "which answers count as a refused write". One page per concern, 3 to 6 pages. Order the pages from the base fact up: the smallest predicate first, the core logic next, the public surface after it, the config, and the tests last. Mark the core page "read line by line". Done when each changed file is on at least one page.
4. **Write the folder** in the **Layout** below. Write the README memory palace last, after every page is done. Done when ``grep -n "`:[0-9]" *.md`` finds nothing, and a reader can paste each reference into the editor and land on the code the page describes.
5. **Commit and open.** In a wm notes dir, commit with the notes rule (`jj -R <notes> commit -m "<phase>: add a reading guide for <change>"`). Run `~/.claude/scripts/open-file.sh <folder>/README.md`. Tell the operator the path and the pages in a table: page and what it covers.

## Where the folder goes

| Case | Folder |
|---|---|
| a wm TODO under review | `<notes-dir>/review/TODO-N/guide/` |
| a repo with `.notes/` | `.notes/guide-<slug>/` |
| anything else | `<scratchpad>/guide-<slug>/` |

`<slug>` is the change in 2 to 4 kebab-case words.

## Layout

### `README.md`

```markdown
# <target> guide: read the <change in plain words>

This guide takes you through the <target> diff in reading order. Each page covers one part of the change. A page tells what the code does, why it does it, and which test proves it. All `file:line` references point to the tip `<sha>` in <checkout> (branch `<branch>`).

To see the whole diff, run `git diff <base> <tip>`, or read [<diff file>](<path>).

## The change in one figure

<a mermaid `flowchart TD` in a mermaid block: the callers on top, the new types in the middle, the external system at the bottom; each node names its file and what it owns>

## Reading order

| Page | What it covers | Files | Size |
|---|---|---|---|
| [1. <concern>](1-<slug>.md) | <the question it answers> | `<repo/path/file>`, `<repo/path/file>:<from>-<to>` | small, start here |
| [2. <concern>](2-<slug>.md) | … | … | the core, read line by line |
| [N. Tests](N-tests.md) | which test proves which behavior | `<test files>` | skim |

## Terms

- **<term>**: <what it is and what it does in this change>

## What the diff does not change

- <a neighbour the reader may suspect, and why it is not touched>

## Memory palace

Read this part after the last page. Walk the route once with the code open, then once with the code closed. The building is <building>. Each room is one file. Each object is one function, and its picture shows what the function does in this change.

### The route

<a mermaid `flowchart LR`: one node per room, in the reading order of the pages; each node names the room and its file>

### Room 1: <room name>, `<repo/path/file>`

| Object | What you see | Function | What it does |
|---|---|---|---|
| <object> | <one picture, at most 20 words, that shows the behavior> | `<function>` (`<repo/path/file>:<from>-<to>`) | <the fact in plain words> |

### Recall drill

Close the code. Answer each question with the room, the object, and the file. Then open the file and check.

| Question | Room and object |
|---|---|
| <a behavior question from the pages, for example "where is the mutex released?"> | <room>, <object>: `<repo/path/file>:<line>` |
```

#### The memory palace

The operator must keep the core files and the core functions in mind after the guide is closed. The last section of the README uses the method of loci (memory palace): each core file is a room on one route, and each core function is one object in that room. The object is a picture of what the function does. To recall a file, the reader walks the route in memory and sees the objects.

- **One room per core file, 3 to 6 rooms.** A core file is a file that a "read line by line" page or the README figure names. Put the test file of the core behavior in the last room. Leave out a file that only one line of the diff touches.
- **2 to 4 objects per room**, one per function that a page covers. Order the objects in the order a reader meets them in the file.
- **The picture shows the behavior, not only the name.** "A receptionist writes the name in the book, then gives back the key before the letter goes out" holds the fact that the mutex is released before the create call. A picture that only rhymes with the name holds no fact.
- **Make the picture odd and concrete**: a size, a motion, a sound, a thing that goes wrong. An odd picture stays in mind, a plain one does not. Put a bug or an open point in its room as a picture of the failure, and link the slug.
- **Keep one building for the whole palace**, for example an office or a workshop, so the rooms connect on one route. The route follows the reading order of the pages.
- **The drill has one question per object.** Take each question from a page, so the answer is a fact the guide proves.
- The pictures are the one place in the guide where an image is allowed. Every other sentence of the README follows the **Language** rules.

### `<n>-<slug>.md`, one per concern

```markdown
# <n>. <concern>

[Back to the guide](README.md) · Previous: [<n-1>. <concern>](<file>) · Next: [<n+1>. <concern>](<file>)

## <The question this code answers | The rule>

<the problem in plain words, before any symbol>

## `<function>` (`<repo/path/file>:<from>-<to>`)

<a short excerpt of the deciding lines, at most 15>

<the facts to read from it, as a numbered list>

<a mermaid `flowchart TD` of the branches: each branch is a labeled edge that ends in a node with its result>

## What differs from what you approved

- <each deviation from the plan, the TODO, or the Surprise, and its reason>

## Tests

| Test | What it proves |
|---|---|
| `<TestName>/<case>` (`<repo/path/file_test>:<line>`) | <the behavior, in plain words> |
```

### `<N>-tests.md`, the last page

- A table of the test servers or fakes: the server, where it is built (full path and line), and what it is used for.
- A table of tests by page, linked to each page.
- The slow, manual, or service runs: each subtest with its line, what it proves, and its last result with its source.
- What no run proves: a skipped service, a CI job that is off.
- The command that runs the tests, in a fenced block.

## Rules

- **Every code reference is the full repo-relative path with its line**: `util/objfs/s3fs/s3_fs_store.go:61-74`. Write it in full every time: in a heading, a table cell, a test row, and a flow. Never write a bare `:61-74`, a path relative to a heading or a table header, or a short path such as `s3fs/s3_fs_store.go`. The reader copies one reference into the editor and lands on the line, with no context from the lines around it. A reference to a whole file is the full path too.
- **Every code reference points to the pinned tip sha.** Give a range (`util/objfs/s3fs/s3_fs_part_uploader.go:160-171`) for a function and one line for a test case. After the branch changes, rewrite each reference against the new tip, and update the sha in the README.
- **A table maps, a flow decides.** Use a table for a mapping (an option to a header, a config field to a limit, a test to a behavior). Use a mermaid flow for each function with more than two branches.
- **Every figure and flow is mermaid.** The pages are markdown files, and the `show-me` skill draws a flow in a markdown file as mermaid. ASCII is for the chat reply only.
- **Say why in the same paragraph as what.** A branch that exists for a reason the code does not show gets the reason next to it: a backend that rejects a request, an earlier review round, the operator's choice.
- **Name the operator's choices as theirs**: "your choice", with the answer it came from. A reader must see which behavior they decided and which the implementer decided.
- **Link open points, do not repeat them.** A gap that waits for a verdict gets one bullet with its slug and a link to the `to-user` file.
- **Link a heading, never a section number.** Do not break a line inside a paragraph.

## Language

Load the `i-have-adhd` skill and apply it to every page. **Use the same name every time**: a synonym reads as a new thing.
