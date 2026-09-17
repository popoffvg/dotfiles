---
name: recheck-style-caps-after-any-comment-rewrite
description: Use whenever a doc comment or code comment is being written or rewritten for any reason — a content fix, a stale-reference removal, a rename follow-up — not only when a style gate flagged it. Triggers before committing a comment edit in a codebase with written comment-style caps (a word-count cap per sentence or per symbol doc, an em-dash rule, a one-fact-per-sentence rule).
metadata:
  origin: self-improvement
---

A comment edit is not exempt from the style caps just because style wasn't the reason for the
edit. Fixing what a comment says can just as easily break the rules governing how long it's allowed
to say it.

## The tell

You are rewriting a comment to fix its content — it names a deleted field, describes removed
behavior, or is otherwise stale or wrong — and the trigger for the edit is a correctness finding,
not a style finding.

## What to do

Before committing the rewrite, check the new text against every style cap the file's rules impose
— word count per sentence, word count per symbol doc, em-dash-with-parenthesis, one-fact-per-sentence
— the same way a style gate would. Do this even though nobody flagged style this round.

## Why it happens

A content-driven rewrite fixes the fact that was wrong and stops there, because the task in front
of you is "make this true," not "make this short." The caps don't announce themselves; a review
round later has to re-read the same lines to catch the overflow, burning a full extra round to fix
a comment that was just rewritten.

A code example inside the comment being rewritten has its own separate check: see `harness-dev:doc-examples-must-lint` for the rule that a snippet in prose must still satisfy the repo's linters, since nothing else checks it either.
