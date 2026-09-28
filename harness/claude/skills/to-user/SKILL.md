---
name: to-user
description: Hand work to the operator as a self-contained file they read cold and edit in their own editor, not in chat. Use for a batch of items that each need a verdict or reply ("list the PR comments with recommended answers", "give me a file to decide on each"), a findings or status handoff ("write up what you found", "explain it to me in a file"), a draft they rewrite in their own words ("draft it and I'll edit it"), and the open choices of an artifact, page, deck, or design before you build it — palette, typefaces, navigation, theme, fidelity to a source file.
version: 0.2.0
---

# to-user

**The operator reads the file cold.** They did not see the code, the chat, or the research. The file carries that context in words and in `show-me` figures before it asks anything, and each block stands alone.

## Steps

1. **Write the file** to the repo, or to the scratchpad when no repo owns it. Name it for the task: `pr-answers.md`, `decisions.md`, `findings.md`. Use **File shape** for a batch, **Prose** for a draft. Fill each field from a source you read — the thread, the diff, the code. A fact you could not read goes under Not checked, never into a field. Done when every item has a block, every field rests on a read source, every term is in Terms or glossed where it first appears, and no `[decide]` block is a bare question — each carries a Detail paragraph and, past a one-sentence set of options, a `show-me` figure.
2. **Open it** with `~/.claude/scripts/open-file.sh <file>`. Tell the operator the path, how many items need an answer, and how to answer: the option letter or the reply on the `Answer:` line.
3. **In the same turn, arm the watch**: `Monitor` with `command: ~/.claude/scripts/watch-answers.sh <file>`, `persistent: true`, and a description that names the file. Keep working; `check-answers` owns each report. A file with only `[info]` items gets no watch. When the next step cannot start until the operator finishes, use `open-file.sh --wait` instead.

Open design choices before a build go through these steps too, including a design-plan step inside another skill. Build from the answers.

## File shape

```markdown
# <task in plain words>

## Context

<what this is and where it comes from>
<the current state: what works, what does not>
<what the operator must do here: "Answer 3 of 5 items; 2 are for your information.">

<one show-me figure of the whole>

## Terms

- **<term>** — <what it is and what it does>

## Items

<blocks, [decide] first, then [review], then [info]>

## Not checked

- <what was not opened, run, or verified>
```

- **Context** lets the operator explain the task to a colleague after one read, with no link opened.
- **Terms** lists every codebase symbol, project word, and abbreviation the file uses. Omit it when there are none.
- **Not checked** is required: it is how far the operator can trust the file.

## Item kinds

| Kind | Title tag | Slot | Empty slot means |
| --- | --- | --- | --- |
| Decide — pick an option, or send a reply (every review comment that needs one) | `[decide]` | `**Answer:**` | not answered yet |
| Review — the work is done, check it | `[review]` | `**Comment:**` | accept |
| Inform — a fact to know, no action | `[info]` | none | — |

## Block

```markdown
### 1. [decide] <short title>

- **Source:** [thread](<url>) · `path/to/file.go:42` — <where this comes from, in words>
- **Original:** > <verbatim text>
- **Detail:** <first sentence names the decision>

  <what the item touches and how it works today>

  <show-me figure>

  | Option | <dimension> | <dimension> |
  | --- | --- | --- |
  | A — <name> | … | … |
  | B — <name> | … | … |

- **Recommended:** <A, or the reply ready to send>

  <the fact that decides it, and what the runner-up costs>

**Answer:**

---
```

- **Source** — a clickable link or `file:line`, plus words on where the item comes from. The link is proof; the words are the context.
- **Original** — verbatim. Omit it when the item has no source text.
- **Detail** — enough to answer with nothing else open. It adds what Original does not say. It glosses each symbol on first use and repeats any fact it needs from another block.
- **Recommended** — the answer the operator would give after doing the work, acceptable as written. The reason names the fact they would attack if they disagree. The slot below stays empty, so an answer tells consent apart from silence.
- `[review]` replaces Recommended with **Done**: the change as a `diff` or a short list. `[info]` carries Source and Detail only.

## Figures

**Pick every figure with `show-me`**, with two changes for a file read as text in an editor: flows, sequences, and states are ASCII in a fenced block; options are a comparison table with lettered rows the operator answers by. Context gets one figure of the whole, always. A block gets one whenever writing each option as one sentence would lose something the operator decides on — which is most blocks with more than two options, or any option that touches more than one file.

## Language

Apply `i-have-adhd` to every field. **Use the same name every time** — a synonym reads as a new thing.

## Prose

A draft the operator rewrites — a spec section, a PR description, a changelog entry, an email — goes out as prose.

| The operator returns | Shape |
| --- | --- |
| a verdict per item | blocks with empty slots |
| rewritten sentences | the prose, under Context and above Not checked |
| both | the prose, then the choices as blocks under `## Open` |

Bracket the passages you are unsure of, so the operator reads those first.

## Deck review

One `[review]` block per slide, for the words the audience sees. The deck markdown format belongs to `slides-in-reveal-markdown`.

- **Source** is the slide's anchor in the rendered deck (`deck.html:295`), not the outline.
- **Original** is the on-screen text. Say in Context that speaker notes are left out, and offer to add them.
- The quoted slide is the recommendation, so the block has no Recommended field. Empty `**Comment:**` means accept.
- Where the outline and the rendered deck differ, make the block `[decide]`, mark it **⚠ Divergence**, and give lettered options. The operator's edit wins only if they see the conflict.
- Say per block what was cut to fit the slide, and where it went.
