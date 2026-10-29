---
name: daily
description: Write the daily done-of-day report for the operator's boss — what the operator did today in one org — from today's Claude Code sessions. Use for "daily", "what did I do today", "write my standup", "daily report for mil", or `/daily <org> [YYYY-MM-DD]`.
argument-hint: "<org> [YYYY-MM-DD]"
---

# Daily report

An **org** is a folder `~/git/<org>/` — for example `mil` holds every project of the mil org. A session belongs to the org when its working directory lies under that folder.

## Steps

1. **Get the org.** The org is REQUIRED. Take it from the arguments. When it is missing, ask for it — list the folders in `~/git/` as options — and stop until the operator answers. Never guess the org from the current directory. Done when you have one org name.
2. **Collect the sessions.** Run `~/.claude/scripts/daily-sessions.py <org> [--date YYYY-MM-DD]` (default date is today). When it exits with "no org folder", show the folder list it prints and ask again. When it prints `sessions=0`, say so and stop. Done when you have the digest.
3. **Group the work.** Merge sessions about the same task, PR, ticket, or block into one item, then sort each item into a project and a status group (Done, In progress, Delays, Next). `U:` lines say what the operator asked, `X:` lines show commits, PRs, and tickets, `A:` is the last state. Apply the detail rule below to every line. Done when each item is one result in one group.
4. **Find the delays.** For each project, look for a finding that stopped it or changed its plan: a model check or review that found a design gap, a rewrite the operator asked for, a blocker on the next step. A sign is many `U:` lines about one problem, or a "rewrite", "redo", or "gap" prompt. Done when each project has its delays or none.
5. **Write the report** in the Slack format below and print it in chat in one code block. Write nothing to disk unless the operator asks.

## The detail rule

The operator's boss reads the report. The boss knows the product and the general idea of each project, but not its design, code, or task ledger. Keep a line only when the boss understands it and needs it: what the product can do now, what is still open, and a delay with its effect on the plan. Say each line as a user-visible result in plain words, in at most about 12 words.

Drop everything about how the work was done — libraries, files, names, linters, refactors, tests, the list of bugs or cases a check found, and a finding that was fixed inside the task without stopping it. Drop internal ids — TODO numbers, increment numbers, commit hashes, note numbers; a PR, ticket, block, or customer name the org knows can stay. Drop work on skills, agents, prompts, and the harness unless it is committed to an org repo, and drop tooling noise such as retries and questions about the agent.

Never write "merged", "landed", or "squashed" — the boss reads only done or not done. Code that reached the target branch is Done.

## Format

The operator pastes the report into the Slack message box, which turns pasted `- ` lines into a list and `*text*` into bold. Print the report inside one fenced code block, so the chat view keeps the `*` marks and the leading spaces, and the operator copies it with `/copy`. Write the project and group names in single-star bold, `*Done*`, never `**Done**`. Use these bullets:

- level 1: `- ` with no indent — one result, open item, or delay
- level 2: `    - ` with 4 spaces — what a delay caused and its state now, or the detail of a decision

Never use `◦`, `•`, or `:black_small_square:` as a bullet: Slack shows them as text, not as a list.

Escape `&`, `<`, `>` as `&amp;`, `&lt;`, `&gt;`. Use the name people at the org know — the product, PR, block, ticket, or customer name — never file paths or session ids.

Write one block per project. The block starts with the project name in bold on its own line, then these status groups in this order, each group name in bold on its own line. Leave out an empty group.

1. `Done` — results finished today, in present tense ("Deploy shows live logs from the cloud").
2. `In progress` — started or waiting work, with its state: in progress, waiting for review, waiting for token budget.
3. `Delays` — one level-1 line per delay, saying what was found; what it caused and its state now go on level 2.
4. `Next` — planned work that has not started. A design decision made today for it goes on level 2 as `:bulb: Decision: <decision>`, then one level-2 line for what it gives the user.

Small items outside a project go in a last block with the same groups and no project name.

Example (print it in a code block the same way):

```
*Cloud installer (GCP)*

*Done*
- Deploy shows live logs from the cloud (CloudRun included)
- Many installations can now share one GCP project

*In progress*
- First end-to-end test on GCP: deploy a small cluster, then remove it
- Comparison with the old install.sh script: the missing parts are listed, waiting for token budget for fixing

*Delays*
- Testing showed that the preview step ("dry run") runs locally instead of in the cloud
    - Redesign is ready and waits for token budget; the Helm chart work waits for it

*Next*
- Link the versions of the installer image, Platforma, Terraform modules and Helm chart
    - :bulb: Decision: one Platforma version selects everything; one release ships all with that version
    - The cloud image carries the Terraform modules and the Helm chart, so no local files are needed
- Check the minimum gcloud version
```

Keep each line under about 100 characters; shorten a longer line, never split it into detail lines. When the digest does not show an outcome, write the last known state, for example `in progress`, and never invent one.
