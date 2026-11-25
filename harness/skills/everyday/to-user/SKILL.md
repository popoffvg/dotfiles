---
name: to-user
description: Hand work to the operator as a self-contained file they read cold and answer outside the chat — a markdown file in the editor, or an interactive HTML page in the Claude Desktop panel. Routes the channel to `agent-to-user` and each figure to `show-me`. Use for a batch of items that each need a verdict or reply ("list the PR comments with recommended answers", "give me a file to decide on each"), a findings or status handoff ("write up what you found", "explain it to me in a file"), a draft they rewrite in their own words ("draft it and I'll edit it"), and the open choices of an artifact, page, deck, or design before you build it — palette, typefaces, navigation, theme, fidelity to a source file. A file the operator only reads to catch up on the current decision is `snapshot`.
allowed-tools: Skill
version: 0.6.0
---

# to-user

**to-user is a router.** It owns the content of a handoff: the file shape, the item kinds, and the block. It takes the rest from two skills:

| Question | Skill that answers it |
| --- | --- |
| Which medium and channel does this environment use, and how does the answer come back? | `agent-to-user` |
| Which form does each figure take? | `show-me`, in the figure forms of the environment |

**The operator reads the handoff cold.** They did not see the code, the chat, or the research. The handoff carries that context in words and in figures before it asks anything, and each block stands alone. Apply the ASD-STE100 rules to every field.

## Steps

1. **Load `agent-to-user` and read the environment.** Its row gives the medium and the figure forms. Done when the medium is known.
2. **Write the handoff** in that medium. Name it for the task: `pr-answers`, `decisions`, `findings`. Put a file in the repo, or in the scratchpad when no repo owns it. Use [File shape](#file-shape) for a batch and [Prose](#prose) for a draft. An HTML page keeps the same sections, the same item tags, and the same slots as answer fields. Fill each field from a source you read — the thread, the diff, the code. A fact you could not read goes under Not checked, never into a field. Done when every item has a block, and a reader who sees only one `[decide]` block can say why it exists and what each option changes.
3. **Hand it over and read the answers back through `agent-to-user`**, in the row "Draft or decision file the operator edits" of the environment. Tell the operator where the handoff is, how many items need an answer, and how to answer: the option letter, or the reply in the answer slot. Run `check-answers` on each answer. Done when the operator has the handoff on screen.

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

<blocks, [do] first, then [decide], then [review], then [info]>

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
| Do — a step only the operator can take: log in, grant access, enter a secret | `[do]` | `**Result:**` | not done yet |

## Block

```markdown
### 1. [decide] <the question, in plain words, ending with "?">

- **Source:** [thread](<url>) · `path/to/file.go:42` — <where this comes from, in words>
- **Original:** > <verbatim text>
- **Why asked:** <the fork: the problem and its paths>. <and-what: what the operator faces on the path you do not recommend>. Not asked: <near choices>. If empty: <your default>.
- **Detail:** <how the thing works today, in plain words, before any symbol>

  <what each option changes, and for whom>

  <show-me figure>

  | Option | What changes | <plain-word dimension> |
  | --- | --- | --- |
  | A — <name> | <effect the operator sees> | … |
  | B — <name> | <effect the operator sees> | … |

- **Recommended:** <A, or the reply ready to send>

  <and-what: what the operator faces on the recommended path>

**Answer:**

---
```

- **Source** — a clickable link or `file:line`, plus words on where the item comes from. The link is proof; the words are the context.
- **Original** — verbatim. Omit it when the item has no source text.
- **Why asked** — at most three sentences: the fork, its and-what, the default. **And-what:** break the path you do not recommend and name what the operator then faces in the product — a behavior, an output, a contract, a cost. No product consequence on either path means no block: pick a path yourself and add it to the nearest block's "Not asked" list, bare, with no reason. Cut any sentence whose loss changes nothing for the operator.
- **Detail** — enough to answer with nothing else open. It adds what Original does not say. Start from the behavior today in plain words; give the symbol after the words, never instead of them. It glosses each symbol on first use and repeats any fact it needs from another block.
- **Options table** — each column header is a plain question the operator compares on ("Files touched", "Breaks callers?"), never a bare term. Each cell is a value read with no lookup; a cell that needs a sentence gets that sentence under the table, keyed by the option letter.
- **Recommended** — the answer the operator would give after doing the work, acceptable as written. The reason is one sentence: the and-what of the recommended path — what the operator faces if they take it. Why asked already holds the other path's and-what; never repeat it. The slot below stays empty, so an answer tells consent apart from silence.
- `[review]` replaces Recommended with **Done**: the change as a `diff` or a short list. `[info]` carries Source and Detail only.
- `[do]` carries Source, Why asked, and the step as one command or one link. It has no options and no Recommended. When the operator can clear the blocker in two ways, pick one yourself. A question whose every option is an action the operator takes outside the file is a `[do]`, never a `[decide]`.

## Figures

**Pick every figure with `show-me`, in the figure forms that the environment row of `agent-to-user` gives.** Context gets one figure of the whole, always. A block gets one whenever writing each option as one sentence would lose something the operator decides on — which is most blocks with more than two options, or any option that touches more than one file.

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
