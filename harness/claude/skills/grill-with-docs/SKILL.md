---
name: grill-with-docs
description: This skill should be used when the user wants a relentless interview that sharpens a plan or design AND records docs (ADRs + glossary) as it goes — "grill me and write it up", "grill with docs".
argument-hint: [what to grill — the plan or design]
user-invocable: false
---

Grill me relentlessly on **$ARGUMENTS** by running the `grilling` skill, and maintain docs as we go with the `domain-modeling` skill — capture each resolved decision as an ADR and each term in the glossary. If `$ARGUMENTS` is empty, grill me on the plan or design currently under discussion.
