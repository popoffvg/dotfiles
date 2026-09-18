---
name: to-user
description: This skill should be used when work belongs in a file the operator edits in their own editor rather than in chat — either a batch of items each needing a decision, edit, or reply, or a draft they will rewrite in their own words (a spec section, a PR description, a changelog, an email). Trigger on "write it to a file for me to edit", "list the PR comments with recommended answers", "prepare answers for me to review", "put the review threads in a file", "draft replies I can fill in", "give me a file to decide on each", "draft it and I'll edit it", "let me rewrite it myself". Also trigger before building an artifact, page, deck, or design when the build carries a batch of open choices (palette, typefaces, navigation model, theme, fidelity to a source file) — write the choices out as answerable blocks instead of resolving them inside the build.
version: 0.1.0
---

# to-user

Write a review file the operator edits in their own editor, one block per item. Each block carries: a link/anchor to the source, the original text, and a recommended answer/action.

## When

A batch of items each needs a per-item human verdict or reply: PR/review comments, open questions, decisions, translation strings, triage items. Chat is wrong for this — the operator wants to edit in place and answer at their pace.

Open design decisions count as such a batch. Before building an artifact, page, deck, or visual design, the build carries choices the operator owns — palette, typefaces, navigation model, light/dark commit, how far to deviate from a source file. Write them as blocks and build from the answers. Two failure modes this replaces: burying the choices in the build (the operator discovers them as finished code), and listing them in chat (unanswerable at their pace, no place to edit). A design-plan step inside another skill is not an exemption — the plan's decisions still route here.

## Procedure

1. Write the file to the repo (or scratchpad if not repo-bound). Name it for the task: `pr-answers.md`, `review-replies.md`, `decisions.md`.
2. One block per item. Every block has four fields:
   - **Source** — clickable link or `file:line` anchor to where the item lives.
   - **Original** — the comment/question/text verbatim, quoted.
   - **Detail** — what the operator needs to decide, written under **Detail per block** below.
   - **Recommended** — the answer itself plus why it is the answer, under **Recommended carries the answer** below.
3. Leave the `**Answer:**` line **empty**. The slot is where the operator writes; an empty slot means they have not answered yet.
4. Open the file with `~/.claude/scripts/open-file.sh <file>`, then tell the operator the path and how to edit (write the option letter or the reply on the `Answer:` line). The script picks the host — Zed window, herdr split pane, or path only. Never call an editor directly.
5. **Arm the watch in the same turn you open the file**: `Monitor` with `command: ~/.claude/scripts/watch-answers.sh <file>`, `persistent: true`, and a description naming the file. Keep working; the `check-answers` skill owns what to do with a report and when the watch is over.

## Language of the file

**Write every field in B1 English, under the ASD-STE100 technical writing standard.** The operator reads the file fast, and often in a second language. A sentence they must read twice costs them the decision.

- **Common words.** Use the word most people know, not the exact rare one. One meaning per word, one word per meaning.
- **Short sentences.** Keep an instruction to 20 words, a description to 25. One idea per sentence.
- **Active voice, present tense.** Name who does what: "the test fails", not "a failure was observed".
- **Same name every time.** A synonym reads as a new thing.
- **No metaphor.** Write the literal fact.

**The operator has no context.** They did not read the code, the chat, or the block above. So each block stands alone:

- **Spell out every term the block uses.** Give a codebase symbol one short gloss on first use: what it is, what it does.
- **Repeat the facts the block needs.** Do not point back at an earlier block for them.
- **State where the item comes from** in words, not only as a link. The link is proof; the words are the context.

## Detail per block

**The operator must be able to answer a block without opening anything else.** Detail closes that gap, under two skills.

**Words: `i-have-adhd` and the language rules above, applied to every field.** Their rules hold as written; two land specially here. Detail's first line names the decision, because the operator skimming ten blocks reads that line and the bold phrase in each. Detail carries no restatement of Original — it says something the quoted text does not, or it is cut.

**Figure: `show-me`, one row from its table.** Whenever the choice is about structure, draw the form that row names. Two adaptations: the review file is read as text, so a forking path is **ASCII, never mermaid**; options being weighed are a **comparison table with lettered rows**, which doubles as the thing the operator answers by name. **The test for structural: write each option as one sentence. If the sentences lose something the operator decides on, draw the form; if they carry it, that sentence is the whole Detail.**

## Recommended carries the answer

**Recommended is the answer the operator would give if they did the work themselves, plus the reason it beat the alternative.** It is a real draft, acceptable as written, never a placeholder. The empty `**Answer:**` line below it is theirs alone — a slot pre-filled with the recommendation destroys the signal: nothing in the file then tells consent apart from silence.

So the field carries two parts:

- **The answer** — the option letter, or the reply text ready to send as written.
- **Why** — the fact that decided it, and what picking the runner-up costs. One short paragraph, not an argument; the operator reads it to disagree, so it must name the thing they would disagree with.

An operator who agrees leaves the block alone or writes the letter. An operator who disagrees now knows which fact to attack.

## Block template

```markdown
### 1. <short title>

- **Source:** [thread](<url>) · `path/to/file.go:42`
- **Original:** > <verbatim comment text>
- **Detail:** <one front-loaded sentence naming the decision>

  | Option | <dimension> | <dimension> |
  | --- | --- | --- |
  | A — <name> | … | … |
  | B — <name> | … | … |

  <one clause on what was not opened, if anything>
- **Recommended:** <A / the drafted reply>

  <why this one — the fact that decides it, and what the runner-up costs>

**Answer:**

---
```

Keep every source anchor clickable — `file:line` or URL.

## Prose the operator edits in place

**Not every handoff is a batch of slots.** A draft the operator rewrites in their own words — a spec section, a PR description, a changelog entry, an email, a design rationale — goes out as prose in a file, not as blocks with `**Answer:**` lines. Forcing continuous text into per-item slots gives them a form to fill where they wanted a paragraph to edit.

Pick the shape by what comes back:

| What the operator returns | Shape |
| --- | --- |
| A verdict per item — accept, reject, pick B | blocks with empty `**Answer:**` slots |
| Rewritten sentences | the prose itself, in the file |
| Both — prose plus a few open choices | prose, with the choices as blocks under a `## Open` heading |

The procedure and the language rules above hold unchanged for the prose form. One thing is added: **mark what you are unsure of** — bracket the passages you want their eye on, rather than leaving them to find the soft spots.

Use `--wait` on `open-file.sh` instead of the watch when the next step cannot start until they have finished editing — `--wait` blocks the turn, the watch lets it continue.

## Special case: a per-slide deck review

A slide deck is a batch — one block per slide, each needing the operator's verdict on the words that will be projected. Use this shape, with the deck's own specializations:

- **Source** is the slide's anchor in the rendered deck (`deck.html:295`), not the outline it came from. The operator is approving what the audience sees.
- **Original** is the **on-screen text only**. Speaker notes are not reproduced — say so in the header, and offer to include them.
- **Recommended** is the slide as built. The quoted text *is* the recommendation, so the block carries a single empty `**Comment:**` slot instead of a separate Recommended field, and empty means accept.
- Where the source outline and the rendered deck have drifted apart, mark that block **⚠ Divergence** and give the operator lettered options as a comparison table. A divergence needs a decision, not a comment — silently reconciling it discards their edit.
- Note per block what was **cut to make the slide fit**, and where it went (usually the speaker notes). Otherwise the operator cannot tell a deliberate cut from an omission.

Slide *format* is a separate concern — see the `slides-in-reveal-markdown` skill for what the deck markdown itself must look like. This skill owns the review file; that one owns the deck.
