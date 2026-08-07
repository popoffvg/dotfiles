---
name: to-user
description: This skill should be used when a task produces a batch of items each needing a human decision, edit, or reply — and the output belongs in an editable file, not chat. Trigger on "write it to a file for me to edit", "list the PR comments with recommended answers", "prepare answers for me to review", "put the review threads in a file", "draft replies I can fill in", "give me a file to decide on each". Also trigger before building an artifact, page, deck, or design when the build carries a batch of open choices (palette, typefaces, navigation model, theme, fidelity to a source file) — write the choices out as answerable blocks instead of resolving them inside the build.
version: 0.1.0
---

# to-user

Write a review file the operator edits in their own editor, one block per item. Each block carries: a link/anchor to the source, the original text, and a recommended answer/action. The operator edits inline; extract only their edits back — don't reread the whole file.

## When

A batch of items each needs a per-item human verdict or reply: PR/review comments, open questions, decisions, translation strings, triage items. Chat is wrong for this — the operator wants to edit in place and answer at their pace.

Open design decisions count as such a batch. Before building an artifact, page, deck, or visual design, the build carries choices the operator owns — palette, typefaces, navigation model, light/dark commit, how far to deviate from a source file. Write them as blocks and build from the answers. Two failure modes this replaces: burying the choices in the build (the operator discovers them as finished code), and listing them in chat (unanswerable at their pace, no place to edit). A design-plan step inside another skill is not an exemption — the plan's decisions still route here.

## Procedure

1. Write the file to the repo (or scratchpad if not repo-bound). Name it for the task: `pr-answers.md`, `review-replies.md`, `decisions.md`.
2. One block per item. Every block has three fields:
   - **Source** — clickable link or `file:line` anchor to where the item lives.
   - **Original** — the comment/question/text verbatim, quoted.
   - **Recommended** — the drafted answer or action, ready to accept or overwrite.
3. Put an editable answer slot the operator fills: an `**Answer:**` line left blank or pre-filled with the recommendation.
4. Open the file with `~/.claude/scripts/open-file.sh <file>`, then tell the operator the path and how to edit (accept the recommendation, or replace the `Answer:` line). The script picks the host — Zed window, herdr split pane, or path only. Never call an editor directly.
5. Extract only the answered slots — grep `^\*\*Answer:\*\*` — don't reparse the file.

## Block template

```markdown
### 1. <short title>

- **Source:** [thread](<url>) · `path/to/file.go:42`
- **Original:** > <verbatim comment text>
- **Recommended:** <drafted reply / action>

**Answer:** <recommended text — edit or accept>

---
```

## Rules

- Recommended field is a real draft, not a placeholder — the operator should be able to accept as-is.
- Keep source anchors clickable (`file:line` or URL).
- Extract by grepping the answer slots; never send the operator back a re-dump of the whole file.

## Special case: a per-slide deck review

A slide deck is a batch — one block per slide, each needing the operator's verdict on the words that
will be projected. Use this shape, with the deck's own specializations:

- **Source** is the slide's anchor in the rendered deck (`deck.html:295`), not the outline it came from.
  The operator is approving what the audience sees.
- **Original** is the **on-screen text only**. Speaker notes are not reproduced — say so in the header,
  and offer to include them.
- **Recommended** is the slide as built. The quoted text *is* the recommendation, so the block carries a
  single empty `**Comment:**` slot instead of a separate Recommended field, and empty means accept.
- Where the source outline and the rendered deck have drifted apart, mark that block **⚠ Divergence**
  and give the operator numbered options. A divergence needs a decision, not a comment — silently
  reconciling it discards their edit.
- Note per block what was **cut to make the slide fit**, and where it went (usually the speaker notes).
  Otherwise the operator cannot tell a deliberate cut from an omission.

Slide *format* is a separate concern — see the `slides-in-reveal-markdown` skill for what the deck
markdown itself must look like. This skill owns the review file; that one owns the deck.
