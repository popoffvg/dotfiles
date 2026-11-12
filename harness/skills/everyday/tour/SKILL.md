---
name: tour
description: Write a tour of a code change from any source — a PR, a branch, a commit or a range, the uncommitted working tree, a wm TODO, or a patch file — as a folder of markdown pages the operator reads next to the code. The README is a `change-review` document of the change (title, why, Outcome, New terms, Components, Flow changes, the increments grouped by commit, Deviations) with a sample of each output a user or an external client sees. Each increment of the change gets one page with its summary, Surprises, Surface, the deciding lines at the tip, and the tests that prove it. Use on "tour", "tour this branch", "guide me through the changes", "walk me through this diff", "review guide", or before the operator reads a diff for an approve verdict. A file that asks for a verdict is `to-user`; the state of the work, not the code, is `snapshot`; one file that teaches a PR area from zero is `change-tour`.
allowed-tools: Bash(~/.claude/scripts/open-file.sh:*)
version: 0.6.0
---

# tour

**The operator reads the tour with the code open beside it.** The tour does not replace the diff. The README is a `change-review` document of the change, so the operator sees why the change exists, what it brings, and which increments are critical before any code. Each increment is one page.

## Steps

1. **Load the `change-review` skill.** It owns the sections, their **Check** lines, the increment parts, and the commit fields. This skill adds only what a tour needs on top: `file:line` references, the outputs, one page per increment, the tests, and the memory aid. Done when you know the increment parts and the `### Commit` fields.
2. **Pin the change.** Find the source kind in [Sources](#sources), and get the base, the tip, and the checkout from its row. Run `git diff --stat <base> <tip>`, or `git diff --stat HEAD` for the working tree. Done when you have the tip, which every `file:line` in the tour points to.
3. **Read every changed source file in full at the tip.** Read the diff hunks of the files that existed before. Read the test files by their test names (`func Test` and `t.Run` in Go), and open a test body only when its name does not say what it proves. List every output the change adds or changes at the system edge: data written to a store or a context, an API request or response, a CLI output, a file, an event, a log line, a UI text. Read the reason for the change from the source of its row in [Sources](#sources). Done when you can say in 1 to 3 sentences what goes wrong without the change, and when you can name, for each changed function, its callers in the diff and the test that covers it, and, for each edge output, the line that builds it.
4. **Cut the change into increments and commits.** Take them from the source first, see [Where the increments come from](#where-the-increments-come-from). Follow the `change-review` rules: one increment, one component, deepest first, a caller moved by a signature change right after it. A hunk outside the purpose of the change gets one line under "What the diff does not change", and no increment. For each increment, decide if it is critical: a wrong line in it loses or corrupts data, breaks a contract that a user or an external client reads, races, or opens a security gap. A rename, a move, or a config value is not critical. Done when each changed hunk is in exactly one increment or in "What the diff does not change", and each increment has its critical verdict.
5. **Pick the memory technique at random.** Read [memory-log.md](memory-log.md). Drop every technique of [Memory techniques](#memory-techniques) that has a `bad` verdict. Number the rest from 0, and run `echo $((RANDOM % <count>))` to pick one. Do not pick by taste: the operator finds the technique that fits only from a fair sample. Done when you have one technique slug.
6. **Write the folder** in the [Layout](#layout) below. Load the `i-have-adhd` skill and apply it to every page. Write the increment pages and `tests.md` first, then the README, and the memory aid last. Done when ``grep -n "`:[0-9]" *.md`` finds nothing, every README H2 that comes from `change-review` has its **Check** line, and a reader can paste each reference into the editor and land on the code the page describes.
7. **Commit and open.** In a wm notes dir, commit with the notes rule (`jj -R <notes> commit -m "<phase>: add a tour of <change>"`). Run `~/.claude/scripts/open-file.sh <folder>/README.md`. Tell the operator the path, the reason for the change in one sentence, and the increments in a table: page, title, and critical or not. Name the memory technique, and ask the operator if it helped: `good`, `bad`, or `so-so`. Append a row to [memory-log.md](memory-log.md) with the verdict empty, and write the verdict when the operator gives it.

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

## Where the increments come from

| Case | Increments | Commits |
|---|---|---|
| The source has a `change-review` document: a wm TODO pair, or a PR body in that shape | Copy its increments and their titles. A shipped difference goes to Deviations, not into the approved text | its `### Commit` sections, matched to the real commits |
| The change has more than one commit | Cut each commit into increments. A later commit that only amends the component of an earlier increment folds into that increment, and its Surprises name the amending commit | one `### Commit` per real commit, with its real title and body; a commit with no increment of its own lists the increments it amends |
| One commit, or the working tree | Cut the diff into increments | the commits the change would need under the `change-review` rules, marked "(proposed)" |

## Where the folder goes

| Case | Folder |
|---|---|
| a wm TODO under review | `<notes-dir>/review/TODO-N/tour/` |
| a repo with `.notes/` | `.notes/tour-<slug>/` |
| anything else | `<scratchpad>/tour-<slug>/` |

`<slug>` is the change in 2 to 4 kebab-case words.

## Layout

```text
README.md            # the change-review document, the outputs, and the memory aid
<c>.<i>-<slug>.md    # one page per increment, in apply order
tests.md             # the test servers, the slow runs, and what no run proves
```

### `README.md`

The sections of `change-review` in its order, with the tour parts inserted. The tour parts are "Why this change", "What you see after the change", the increments table, "What the diff does not change", and the memory aid. A tour part has no **Check** line.

```markdown
# <the title from change-review: what the change brings>

This tour takes you through the <target> diff one increment at a time. All `file:line` references point to the tip `<sha>` in <checkout> (branch `<branch>`). To see the whole diff, run `git diff <base> <tip>`.

## Why this change

<what goes wrong without the change, in 1 to 3 sentences, and its source: the PR body, the issue, a commit message, the TODO Outcome; "(inferred)" when no source states it>

## Outcome

## New terms            (optional, as in change-review)

## Components

## Flow changes

## What you see after the change

<one H3 per edge output from step 3: who sees it (a user, an operator, an external client), where (a store, a context, an API, a CLI), and when>

### <output name> (`<repo/path/file>:<from>-<to>`)

<a fenced sample of the output after the change, with real field names and realistic values, in its true format (JSON, YAML, CLI text)>

<before the change: the old sample, or "nothing">

<what changed, as a short list: a field added, renamed, or removed, a new value, a new order>

## Increments

> **Check:** <the Increments Check line from change-review, verbatim>

| Page | Increment | Component | Critical |
|---|---|---|---|
| [1.1](1.1-<slug>.md) | <title> | `<package.Symbol>` | **yes**: <what breaks when a line here is wrong>; read line by line |
| [1.2](1.2-<slug>.md) | <title> | `<package.Symbol>` | no |

---

### Commit 1

<Title, Body, and Proves from change-review; each Proves case links its page: `[<case>](<c>.<i>-<slug>.md#tests)`>

<the next commit's rows, then its ### Commit section>

## Deviations

## What the diff does not change

- <a neighbour the reader may suspect, and why it is not touched>

## Memory aid: <technique slug>
```

The Components tree is the figure of the whole change. Draw no second figure.

### `<c>.<i>-<slug>.md`, one per increment

`<slug>` is the increment title in 2 to 4 kebab-case words. The increment exactly as `change-review` writes it, with the heading as the page title and the deciding lines added after **Surface**.

```markdown
# <c>.<i>. <imperative title>

[Back to the tour](README.md) · Previous: [<c>.<i-1>. <title>](<file>) · Next: [<c>.<i+1>. <title>](<file>)

*`<package.Symbol>`* (`<repo/path/file>:<from>-<to>`)

<the summary>

- **Change:**
- **Extends:**
- **Critical:** <yes: what breaks | no>
- **Surprises:** <each bullet ends with the `<repo/path/file>:<line>` that shows it>
- **Surface:**

## The deciding lines

### `<function>` (`<repo/path/file>:<from>-<to>`)

<a short excerpt of the deciding lines at the tip, at most 15>

<the facts to read from it, as a numbered list>

<a mermaid `flowchart TD` when the function has more than two branches: each branch is a labeled edge that ends in a node with its result>

## Tests

| Test | What it proves |
|---|---|
| `<TestName>/<case>` (`<repo/path/file_test>:<line>`) | <the behavior, in plain words> |
```

"The deciding lines" has one H3 per function of the increment that decides a branch or builds a value. An increment with no such function (a rename, a move, a wiring) writes `none — <reason>` under the H2. An increment with no test of its own writes one row: `none — <the commit whose Proves covers it, or why no test can>`.

### `tests.md`

- A table of the test servers or fakes: the server, where it is built (full path and line), and what it is used for.
- The slow, manual, or service runs: each subtest with its line, what it proves, and its last result with its source.
- What no run proves: a skipped service, a CI job that is off.
- The command that runs the tests, in a fenced block.

### Memory techniques

The operator must keep the core files and the core functions in mind after the tour is closed. A core file is a file that a critical increment names. When no increment is critical, the core files are the files of the `main` component.

| Slug | The technique | What the README section holds |
|---|---|---|
| `story-chain` | Link method: one story in which each core function is a character that acts in call order. | One story of 5 to 10 sentences. Each sentence names one function and its `file:line`, and shows what it does as an action. Make each action odd and concrete: a size, a motion, a thing that goes wrong. |
| `feynman` | Teach-back: explain the change to a newcomer in plain words, with no symbol. | A plain-words explanation of at most 150 words. Then a table: each plain phrase, and the function and `file:line` it stands for. |
| `flashcards` | Retrieval practice: answer a question from memory before you see the answer. | 8 to 12 cards as `<details>` blocks: the question in `<summary>`, the answer with its `file:line` inside. Order the cards in apply order. |
| `why-questions` | Elaborative interrogation: ask why the code does each thing and why not the obvious other way. | One "Why ...? Why not ...?" pair per core function. Each answer gives the reason and its `file:line`. |
| `chunks` | Chunking: group the core functions into 3 or 4 named chunks, and join the first letters of the names into one word. | A table: the chunk name, its functions with `file:line`, and what the chunk does as a whole. Above it, the word that the first letters make. |
| `draw-from-memory` | Free recall: draw the flow from memory, then compare it with the true flow. | A task: "Close the code and draw the call path from <entry> to <end>." Then the true flow in a collapsed `<details>` block, as a mermaid `flowchart TD` with `file:line` in each node. |

The memory aid section opens with one line: how to use the technique, from its row. Then it holds the body the row asks for, and a **Recall drill**: a table of 4 to 8 behavior questions ("where is the mutex released?") with the fact and its `file:line`. The drill is the check that the technique worked.

- **Take every fact from a page.** The memory aid adds no fact that the pages do not prove.
- **Put a bug or an open point in the memory aid too**, and link its slug.
- The `story-chain` story is the one place in the tour where an image is allowed.

## Rules

- **Paths are in, unlike a plain `change-review`.** The operator reads the tour next to the code, so every symbol that a page explains gets its `file:line` at the tip. The **Surface** diff stays as `change-review` writes it.
- **Every code reference is the full repo-relative path with its line**: `util/objfs/s3fs/s3_fs_store.go:61-74`. Write it in full every time: in a heading, a table cell, a test row, and a flow. Never write a bare `:61-74`, a path relative to a heading or a table header, or a short path such as `s3fs/s3_fs_store.go`. The reader copies one reference into the editor and lands on the line, with no context from the lines around it.
- **Every code reference points to the pinned tip sha.** Give a range for a function and one line for a test case. After the source changes, rewrite each reference against the new tip, and update the sha in the README. For the working tree, the references point to the files on disk, and the README says "uncommitted on top of `<HEAD sha>`".
- **A table maps, a flow decides.** Use a table for a mapping (an option to a header, a config field to a limit, a test to a behavior). Flow changes use the `show-me` form that `change-review` names; a branch flow on an increment page is mermaid.
- **Show the output, not only the code that builds it.** Build each sample from the code that writes it: the struct and its tags, the template, the format string. Take values from a test fixture when one exists, and say so. A change with no edge output says so in one line under the heading.
- **Say why in the same paragraph as what.** A branch that exists for a reason the code does not show gets the reason next to it: a backend that rejects a request, an earlier review round, the operator's choice.
- **Name the operator's choices as theirs**: "your choice", with the answer it came from. A reader must see which behavior they decided and which the implementer decided.
- **Link open points, do not repeat them.** A gap that waits for a verdict gets one bullet with its slug and a link to the `to-user` file.
