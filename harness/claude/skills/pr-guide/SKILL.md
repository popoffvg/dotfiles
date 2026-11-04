---
name: pr-guide
description: Write a reading guide for a code change, as a folder of markdown pages the operator reads next to the code. It holds a README with one figure of the whole change, a sample of each output a user or an external client sees after the merge, and the reading order, then one page per concern with the code paths as mermaid flows, the deviations from what was approved, and a table of the tests that prove each behavior. Use on "guide me through the changes", "create md docs for the diff", "walk me through this branch", "review guide", or before the operator reads a diff for an approve verdict. A file that asks for a verdict is `to-user`; the state of the work, not the code, is `snapshot`.
allowed-tools: Bash(~/.claude/scripts/open-file.sh:*)
version: 0.4.0
---

# pr-guide

**The operator reads the guide with the code open beside it.** The guide does not replace the diff. It gives the order to read the diff in, what each part does and why, and which test proves it. It asks nothing, so it has no `Answer:` slot. A point that needs a verdict goes to a `to-user` file, and the guide links to it.

## Steps

1. **Pin the change.** Find the base and the tip commit, the branch, and the checkout. Run `git diff --stat <base> <tip>`. Done when you have the tip sha, which every `file:line` in the guide points to.
2. **Read every changed source file in full at the tip.** Read the diff hunks of the files that existed before. Read the test files by their `func Test` and `t.Run` names, and open a test body only when its name does not say what it proves. List every output the change adds or changes at the system edge: data written to a store or a context, an API request or response, a CLI output, a file, an event, a log line, a UI text. Done when you can name, for each changed function, its callers in the diff and the test that covers it, and, for each edge output, the line that builds it.
3. **Cut the change into concerns, not files.** A concern is one question the code answers, for example "which answers count as a refused write". One page per concern, 3 to 6 pages. Order the pages from the base fact up: the smallest predicate first, the core logic next, the public surface after it, the config, and the tests last. Mark the core page "read line by line". Done when each changed file is on at least one page.
4. **Pick the memory technique at random.** Read [memory-log.md](memory-log.md). Drop every technique of [Memory techniques](#memory-techniques) that has a `bad` verdict. Number the rest from 0, and run `echo $((RANDOM % <count>))` to pick one. Do not pick by taste: the operator finds the technique that fits only from a fair sample. Done when you have one technique slug.
5. **Write the folder** in the **Layout** below. Write the README memory aid last, after every page is done. Done when ``grep -n "`:[0-9]" *.md`` finds nothing, and a reader can paste each reference into the editor and land on the code the page describes.
6. **Commit and open.** In a wm notes dir, commit with the notes rule (`jj -R <notes> commit -m "<phase>: add a reading guide for <change>"`). Run `~/.claude/scripts/open-file.sh <folder>/README.md`. Tell the operator the path and the pages in a table: page and what it covers. Name the memory technique, and ask the operator if it helped: `good`, `bad`, or `so-so`. Append a row to [memory-log.md](memory-log.md) with the verdict empty, and write the verdict when the operator gives it.

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

## What you see after the merge

<one subsection per edge output from step 2: who sees it (a user, an operator, an external client), where (a store, a context, an API, a CLI), and when>

### <output name> (`<repo/path/file>:<from>-<to>`)

<a fenced sample of the output after the merge, with real field names and realistic values, in its true format (JSON, YAML, CLI text)>

<before the merge: the old sample, or "nothing">

<what changed, as a short list: a field added, renamed, or removed, a new value, a new order>

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

## Memory aid: <technique slug>

Read this part after the last page. <one line: how to use this technique, from its row in the memory techniques table>

<the body that the row of the technique asks for>

### Recall drill

Close the code. Answer each question from memory. Then open the file and check.

| Question | Answer |
|---|---|
| <a behavior question from the pages, for example "where is the mutex released?"> | <the fact>: `<repo/path/file>:<line>` |
```

#### Memory techniques

The operator must keep the core files and the core functions in mind after the guide is closed. The last section of the README holds one memory aid, built with one technique from this table. Step 4 picks the technique at random, and [memory-log.md](memory-log.md) records whether it helped. A core file is a file that a "read line by line" page or the README figure names.

| Slug | The technique | What the README section holds |
|---|---|---|
| `story-chain` | Link method: one story in which each core function is a character that acts in call order. | One story of 5 to 10 sentences. Each sentence names one function and its `file:line`, and shows what it does as an action. Make each action odd and concrete: a size, a motion, a thing that goes wrong. |
| `feynman` | Teach-back: explain the change to a newcomer in plain words, with no symbol. | A plain-words explanation of at most 150 words. Then a table: each plain phrase, and the function and `file:line` it stands for. |
| `flashcards` | Retrieval practice: answer a question from memory before you see the answer. | 8 to 12 cards as `<details>` blocks: the question in `<summary>`, the answer with its `file:line` inside. Order the cards from the base fact to the core. |
| `why-questions` | Elaborative interrogation: ask why the code does each thing and why not the obvious other way. | One "Why ...? Why not ...?" pair per core function. Each answer gives the reason and its `file:line`. |
| `chunks` | Chunking: group the core functions into 3 or 4 named chunks, and join the first letters of the names into one word. | A table: the chunk name, its functions with `file:line`, and what the chunk does as a whole. Above it, the word that the first letters make. |
| `draw-from-memory` | Free recall: draw the flow from memory, then compare it with the true flow. | A task: "Close the code and draw the call path from <entry> to <end>." Then the true flow in a collapsed `<details>` block, as a mermaid `flowchart TD` with `file:line` in each node. |

- **Take every fact from a page.** The memory aid adds no fact that the pages do not prove.
- **Put a bug or an open point in the memory aid too**, and link its slug.
- **The recall drill has 4 to 8 questions** for every technique. It is the check that the technique worked.
- The `story-chain` story is the one place in the guide where an image is allowed. Every other sentence of the README follows the **Language** rules.

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
- **Show the output, not only the code that builds it.** For each edge output, write a sample the reader could see after the merge, in its true format. Build the sample from the code that writes it: the struct and its tags, the template, the format string. Take values from a test fixture when one exists, and say so. A change with no edge output says so in one line under the heading.
- **Say why in the same paragraph as what.** A branch that exists for a reason the code does not show gets the reason next to it: a backend that rejects a request, an earlier review round, the operator's choice.
- **Name the operator's choices as theirs**: "your choice", with the answer it came from. A reader must see which behavior they decided and which the implementer decided.
- **Link open points, do not repeat them.** A gap that waits for a verdict gets one bullet with its slug and a link to the `to-user` file.
- **Link a heading, never a section number.** Do not break a line inside a paragraph.

## Language

Load the `i-have-adhd` skill and apply it to every page. **Use the same name every time**: a synonym reads as a new thing.
