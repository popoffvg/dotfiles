---
name: grilling
description: This skill should be used when the user wants to grill, stress-test, or poke holes in a plan, decision, or idea before acting — or uses any 'grill' trigger phrase ("grill me", "stress-test this", "interrogate my plan").
argument-hint: [what to grill — the plan, decision, or idea]
user-invocable: false
---

Interview me relentlessly about every aspect of **$ARGUMENTS** until we reach a shared understanding. If `$ARGUMENTS` is empty, grill me on the plan, decision, or idea currently under discussion.

Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing. Asking multiple questions at once is bewildering.

If a *fact* can be found by exploring the environment (filesystem, tools, etc.), look it up rather than asking me. The *decisions*, though, are mine — put each one to me and wait for my answer.

Not every branch is a decision for me. A branch whose options differ only in internal behaviour I never see or type — a recovery default, a fallback when a lookup misses, a sort order, whether a degraded record is still reported — is yours: pick the option that destroys no work of mine, state the pick and the reason in one line, and continue down the tree. Put a branch to me when it changes what I see, type, or install; when reversing it costs real work; or when it is a matter of taste. If I answer a branch with "you decide", that branch was in the first group — take its siblings yourself instead of asking again.

Do not act on it until I confirm we have reached a shared understanding.

## Output contract

When the grilling session ends, provide:
1. Final shared understanding summary
2. Decision log (what/why)
3. Remaining unknowns
4. Recommended next action list
