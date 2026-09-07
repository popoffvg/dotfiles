---
name: threshold-alone-is-not-a-discriminator
description: Use when building an automated gate that judges the quality of text or code rather than its correctness — a lint rule for comments or naming, a hook that flags repeated prose, a commit-message or doc-shape check, a duplicate detector, any similarity or overlap score with a cutoff. Triggers on "flag comments that just restate the code", "block duplicated sections", "warn when the message repeats itself", "add a lint rule for X style", or wiring a PreToolUse/PostToolUse/Stop hook that grades output.
metadata:
  origin: self-improvement
---

Find the feature that only the acceptable class has, before picking any cutoff.

A similarity score ranks the two classes together, so no cutoff separates them. Text that
explains a subject shares that subject's vocabulary — a comment stating an invariant about
`retryCounter` names `retryCounter`, exactly as a comment paraphrasing it does. A cutoff high
enough to spare the good text lets the bad text through, and one low enough to catch the bad
text blocks the good.

## Procedure

1. **Collect real samples of both classes** — at least two that must be flagged and two that
   must not, copied from the corpus the gate will run on. Invented samples share the author's
   idea of the classes and hide the overlap that real text has.

2. **Name the feature only the acceptable class carries.** Prefer a lexical marker that is
   cheap to test and hard to fake:

   | Class pair | Feature that separates them |
   |---|---|
   | a reason vs a paraphrase | causal or contrast words — `because, so, not, must, never, instead, unless, rather` |
   | a claim vs a hedge | an evidence token — a path, a line number, a command, a URL |
   | a fact vs a restatement | a word absent from the thing being described |

3. **Exempt on the feature, rank on the score.** The score decides which of the remaining
   candidates to report; the feature decides who is exempt from being scored at all.

4. **Test both classes and read both exit codes.** A gate verified only on what it must catch
   is unverified: the cost of the gate is the legitimate output it blocks.

5. **Report only what the current edit introduced.** A gate that judges a whole file on every
   edit re-reports pre-existing text forever, and the noise trains the reader to ignore it.
   Anchor each finding to a line the edit wrote.

6. **Default to warn.** Feed the finding back as context and let the writer answer it. Promote
   to blocking after the exemption list stops growing.

## When a case class sits outside the gate's reach

Widening the window is the wrong fix. A window that reaches far enough to find a distant
reference also pulls in unrelated text, and the false-positive rate rises across every case,
not only the class being chased.

Route that class to whatever already reads the whole change — a review agent, a pre-merge
check — and say in the gate's own documentation which class it does not cover. An
undocumented blind spot reads as "checked and clean".

## Do not

- Tune the cutoff until the sample set passes. That fits the samples, not the classes.
- Ship a gate whose only test is the case it must catch.
- Claim a gate enforces a rule when it covers one mechanically decidable slice of it. Name the
  slice.
