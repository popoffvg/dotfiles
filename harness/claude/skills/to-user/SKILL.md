---
name: to-user
description: This skill should be used when a task produces a batch of items each needing a human decision, edit, or reply — and the output belongs in an editable file, not chat. Trigger on "write it to a file for me to edit", "list the PR comments with recommended answers", "prepare answers for me to review", "put the review threads in a file", "draft replies I can fill in", "give me a file to decide on each".
version: 0.1.0
---

# to-user

Write a review file the operator edits in their own editor, one block per item. Each block carries: a link/anchor to the source, the original text, and a recommended answer/action. The operator edits inline; extract only their edits back — don't reread the whole file.

## When

A batch of items each needs a per-item human verdict or reply: PR/review comments, open questions, decisions, translation strings, triage items. Chat is wrong for this — the operator wants to edit in place and answer at their pace.

## Procedure

1. Write the file to the repo (or scratchpad if not repo-bound). Name it for the task: `pr-answers.md`, `review-replies.md`, `decisions.md`.
2. One block per item. Every block has three fields:
   - **Source** — clickable link or `file:line` anchor to where the item lives.
   - **Original** — the comment/question/text verbatim, quoted.
   - **Recommended** — the drafted answer or action, ready to accept or overwrite.
3. Put an editable answer slot the operator fills: an `**Answer:**` line left blank or pre-filled with the recommendation.
4. Tell the operator the file path and how to edit (accept the recommendation, or replace the `Answer:` line).
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
