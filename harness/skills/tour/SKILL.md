---
name: tour
description: Write a tour of a code change from any source — a PR, a branch, a commit or a range, the uncommitted working tree, a wm TODO, or a patch file — as a folder of markdown pages the operator reads next to the code. The first page says why the change exists and lists its main parts with the critical ones marked, then holds one figure of the whole change, a sample of each output a user or an external client sees after the change, and the reading order. One page per concern follows, with the code paths as mermaid flows, the deviations from what was approved, and a table of the tests that prove each behavior. Use on "tour", "tour this branch", "guide me through the changes", "walk me through this diff", "review guide", or before the operator reads a diff for an approve verdict. A file that asks for a verdict is `to-user`; the state of the work, not the code, is `snapshot`; one file that teaches a PR area from zero is `change-tour`.
allowed-tools: Bash(~/.claude/scripts/open-file.sh:*)
version: 0.5.0
---

# tour

**The operator reads the tour with the code open beside it.** The tour does not replace the diff. The first page answers two questions before any code: why does this change exist, and which parts are critical?

## Steps

1. **Pin the change.** Find the source kind in [Sources](#sources), and get the base, the tip, and the checkout from its row. Run `git diff --stat <base> <tip>`, or `git diff --stat HEAD` for the working tree. Done when you have the tip, which every `file:line` in the tour points to.
2. **Read every changed source file in full at the tip.** Read the diff hunks of the files that existed before. Read the test files by their test names (`func Test` and `t.Run` in Go), and open a test body only when its name does not say what it proves. List every output the change adds or changes at the system edge: data written to a store or a context, an API request or response, a CLI output, a file, an event, a log line, a UI text. Read the reason for the change from the source of its row in [Sources](#sources). Done when you can say in 1 to 3 sentences what goes wrong without the change, and when you can name, for each changed function, its callers in the diff and the test that covers it, and, for each edge output, the line that builds it.
3. **Cut the change into concerns, not files.** A concern is one question the code answers, for example "which answers count as a refused write". One page per concern, 3 to 6 pages. A hunk outside the purpose of the change gets one line under "What the diff does not change", and no page. Order the pages from the base fact up: the smallest predicate first, the core logic next, the public surface after it, the config, and the tests last. Mark the core page "read line by line". For each concern, write why the change needs it, and whether it is critical: a wrong line in it loses or corrupts data, breaks a contract that a user or an external client reads, races, or opens a security gap. Done when each changed file is on at least one page, and each page has its reason and its critical verdict.
4. **Pick the memory technique at random.** Read [memory-log.md](memory-log.md). Drop every technique of [Memory techniques](#memory-techniques) that has a `bad` verdict. Number the rest from 0, and run `echo $((RANDOM % <count>))` to pick one. Do not pick by taste: the operator finds the technique that fits only from a fair sample. Done when you have one technique slug.
5. **Write the folder** in the **Layout** below. Write the README memory aid last, after every page is done. Done when ``grep -n "`:[0-9]" *.md`` finds nothing, and a reader can paste each reference into the editor and land on the code the page describes.
6. **Commit and open.** In a wm notes dir, commit with the notes rule (`jj -R <notes> commit -m "<phase>: add a tour of <change>"`). Run `~/.claude/scripts/open-file.sh <folder>/README.md`. Tell the operator the path, the reason for the change in one sentence, and the pages in a table: page, what it covers, and critical or not. Name the memory technique, and ask the operator if it helped: `good`, `bad`, or `so-so`. Append a row to [memory-log.md](memory-log.md) with the verdict empty, and write the verdict when the operator gives it.

## Sources

The caller names the change in any form. With no source named, take the working tree, and the branch when the working tree is clean.

| Source | Example | Base and tip | Reason for the change |
|---|---|---|---|
| a PR | `#2339`, a PR URL | `gh pr view <n> --json baseRefOid,headRefOid`; check out the head, or read it with `gh pr diff <n>` | the PR body, the linked issue (`closingIssuesReferences`), the review comments |
| a branch | `feat/stats` | `git merge-base <default branch> <branch>`, and the branch head | the commit messages, the PR of the branch if one exists |
| a commit or a range | `abc123`, `a1..b2` | the parent of the commit, or the two ends of the range | the commit messages |
| the working tree | "my changes" | `HEAD`, and the uncommitted files; the tip is "the working tree on top of `<HEAD sha>`" | the operator's request in this session, the notes dir |
| a wm TODO | `TODO-4` | the first and last commit of the TODO | the TODO Outcome, the spec, the ADRs it cites |
| a patch file | `fix.patch` | the commit the patch names, else `HEAD`; apply it in a scratch worktree | the patch header |

When no source states the reason, derive it from the diff and end the sentence with "(inferred)".

## Where the folder goes

| Case | Folder |
|---|---|
| a wm TODO under review | `<notes-dir>/review/TODO-N/tour/` |
| a repo with `.notes/` | `.notes/tour-<slug>/` |
| anything else | `<scratchpad>/tour-<slug>/` |

`<slug>` is the change in 2 to 4 kebab-case words.

## Layout

### `README.md`

```markdown
# <target> tour: <change in plain words>

This tour takes you through the <target> diff in reading order. Each page covers one part of the change. A page tells what the code does, why it does it, and which test proves it. All `file:line` references point to the tip `<sha>` in <checkout> (branch `<branch>`).

To see the whole diff, run `git diff <base> <tip>`, or read [<diff file>](<path>).

## Why this change

<what goes wrong without the change, in 1 to 3 sentences, and its source: the PR body, the issue, a commit message, the TODO Outcome; "(inferred)" when no source states it>

## Main parts

| Part | What it does | Why the change needs it | Critical | Page |
|---|---|---|---|---|
| <part> | <one line> | <one line> | **yes**: <what breaks when a line here is wrong> | [2. <concern>](2-<slug>.md) |
| <part> | <one line> | <one line> | no | [1. <concern>](1-<slug>.md) |

## The change in one figure

<a mermaid `flowchart TD` in a mermaid block: the callers on top, the new types in the middle, the external system at the bottom; each node names its file and what it owns>

## What you see after the change

<one subsection per edge output from step 2: who sees it (a user, an operator, an external client), where (a store, a context, an API, a CLI), and when>

### <output name> (`<repo/path/file>:<from>-<to>`)

<a fenced sample of the output after the change, with real field names and realistic values, in its true format (JSON, YAML, CLI text)>

<before the change: the old sample, or "nothing">

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

The operator must keep the core files and the core functions in mind after the tour is closed. A core file is a file that a "read line by line" page or the README figure names.

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
- The `story-chain` story is the one place in the tour where an image is allowed. Every other sentence of the README follows `i-have-adhd`.

### `<n>-<slug>.md`, one per concern

```markdown
# <n>. <concern>

[Back to the tour](README.md) · Previous: [<n-1>. <concern>](<file>) · Next: [<n+1>. <concern>](<file>)

## <The question this code answers | The rule>

<the problem in plain words, before any symbol>

## `<function>` (`<repo/path/file>:<from>-<to>`)

<a short excerpt of the deciding lines, at most 15>

<the facts to read from it, as a numbered list>

<a mermaid `flowchart TD` of the branches: each branch is a labeled edge that ends in a node with its result>

## What differs from what you approved

- <each deviation from the plan, the TODO, or the Surprise, and its reason; "No plan to compare" when the source has none>

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

- **The first page answers why and what is critical before any code.** The table has 3 to 6 parts, one per page, except the tests page. Put the critical parts first. Each critical part names what breaks, and its page is marked "read line by line". A part that is only a rename, a move, or a config value is not critical.
- **Every code reference is the full repo-relative path with its line**: `util/objfs/s3fs/s3_fs_store.go:61-74`. Write it in full every time: in a heading, a table cell, a test row, and a flow. Never write a bare `:61-74`, a path relative to a heading or a table header, or a short path such as `s3fs/s3_fs_store.go`. The reader copies one reference into the editor and lands on the line, with no context from the lines around it. A reference to a whole file is the full path too.
- **Every code reference points to the pinned tip sha.** Give a range (`util/objfs/s3fs/s3_fs_part_uploader.go:160-171`) for a function and one line for a test case. After the source changes, rewrite each reference against the new tip, and update the sha in the README. For the working tree, the references point to the files on disk, and the README says "uncommitted on top of `<HEAD sha>`".
- **A table maps, a flow decides.** Use a table for a mapping (an option to a header, a config field to a limit, a test to a behavior). Use a mermaid flow for each function with more than two branches.
- **Every figure and flow is mermaid.** ASCII is for the chat reply only.
- **Show the output, not only the code that builds it.** For each edge output, write a sample the reader could see after the change, in its true format. Build the sample from the code that writes it: the struct and its tags, the template, the format string. Take values from a test fixture when one exists, and say so. A change with no edge output says so in one line under the heading.
- **Say why in the same paragraph as what.** A branch that exists for a reason the code does not show gets the reason next to it: a backend that rejects a request, an earlier review round, the operator's choice.
- **Name the operator's choices as theirs**: "your choice", with the answer it came from. A reader must see which behavior they decided and which the implementer decided.
- **Link open points, do not repeat them.** A gap that waits for a verdict gets one bullet with its slug and a link to the `to-user` file.
- **Load the `i-have-adhd` skill** and apply it to every page.
