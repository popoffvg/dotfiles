---
name: grill-me
description: This skill should be used when the user wants to be interviewed relentlessly about a plan or design until shared understanding — "grill me", "get grilled on my design", "walk the decision tree with me".
argument-hint: [what to grill — the plan or design]
user-invocable: false
---

Interview me relentlessly about every aspect of **$ARGUMENTS** until
we reach a shared understanding. If `$ARGUMENTS` is empty, grill me on the
plan or design currently under discussion. Walk down each branch of the design
tree resolving dependencies between decisions one by one.

If a question can be answered by exploring the codebase, explore
the codebase instead.

For each question, provide your recommended answer.

## Operating mode

- Ask one focused question at a time.
- Prefer depth-first questioning through one branch before switching branches.
- Keep a live checklist of resolved vs unresolved decisions.
- Every 5-8 questions, summarize: assumptions, decisions, risks, open questions.
- Stop only when open questions are exhausted or the user says stop.

## Output contract

When the grilling session ends, provide:
1. Final shared understanding summary
2. Decision log (what/why)
3. Remaining unknowns
4. Recommended next action list
