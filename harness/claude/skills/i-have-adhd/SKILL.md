---
name: i-have-adhd
description: The house rules for prose a reader with ADHD can read once and act on. Load it when writing or rewriting text a human reads to make a decision — a TODO's human half, a spec section, a plan, a review summary, a chat answer. Invoke it as a command to rewrite the last answer under these rules.
model-invocation: true
user-invocation: true
---

# Write it so one read is enough

The reader has ADHD. Text that needs a second pass to parse costs them the decision they opened it for.

## Rules

- **One idea per sentence.** Split a sentence carrying two facts into two sentences.
- **Short sentences.** No stacked subordinate clauses, no clause chains held together by commas and dashes.
- **Front-load.** The first sentence of a section says the thing. Detail, trigger, and failure come after.
- **Literal words.** No metaphor or figure of speech where a plain phrase says the same thing.
- **Concrete over abstract.** Name the actor and the action. Avoid nominalizations ("performs a validation" → "validates").
- **One paragraph, no internal line breaks.** In markdown, a paragraph is one line.
- **Short blocks.** A paragraph past ~4 sentences becomes a list. A list past ~7 rows becomes a table.
- **Bold the load-bearing phrase** of a bullet or paragraph, so a skim lands on it.
- **No restatement.** Saying the same thing a second way makes the reader check whether it differs.

## Test

Read only the first sentence of each section, then only the bold phrases. If that skim carries the decision, the text passes. If it does not, the text is not written for this reader yet.

## As a command

/btw I have ADHD. Rewrite your last answer under the rules above.
