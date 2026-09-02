---
name: grill-with-docs
description: This skill should be used when the user wants a relentless interview that sharpens a plan or design AND records docs (ADRs + glossary) as it goes — "grill me and write it up", "grill with docs".
argument-hint: [what to grill — the plan or design]
user-invocable: false
---

Grill me relentlessly on **$ARGUMENTS** by running the `grilling` skill, and maintain docs as we go with the `domain-modeling` skill — capture each resolved decision as an ADR and each term in the glossary. If `$ARGUMENTS` is empty, grill me on the plan or design currently under discussion.

**The questions go in a file, not in chat** — one round at a time, through the `to-user` skill, one block per question with a recommended answer I can accept as written. Read back only the answered slots, then open the next round with the questions my answers unlocked.

**Where the glossary lives depends on the caller.** Inside a wm flow — a `<notes-dir>/spec.md` exists — the glossary is `<notes-dir>/GLOSSARY.md`, not `CONTEXT.md`, and every new or renamed term needs my approval first (`wm` plugin, `code:ref-subcommand-rules.md` § Glossary). Outside a wm flow, `domain-modeling` picks the file as it normally does.
