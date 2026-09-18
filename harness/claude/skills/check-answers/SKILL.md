---
name: check-answers
description: Act on what the operator wrote into a file the `to-user` skill handed them — do the work each answer unblocks, and know when the watch is over. Use when a monitor report for a review file lands in chat, when the user says "check my answers", "did I answer yet", "read the file again", or after they say they are done editing.
version: 0.1.0
---

# check-answers

`to-user` hands the operator a review file and arms a `Monitor` on it. Every save the operator finishes arrives in chat as one report. This skill is what to do with a report.

## Procedure

1. Branch on the report's `status`. **`NEW`** — act on the answers in the diff, under **Acting on an answer**. **`DONE`** — act on the last answers and say the file is closed out; the watch has already exited.
2. Report in one line what arrived — `2 of 7 answered, acting on 3 and 5`. Never re-dump the review file and never grep it whole; the diff is what the report is for.

**Asked for a status outside a report** — "did I answer yet", or the operator says they are done — run `~/.claude/scripts/answers-since.sh <file>` once. It prints the same report on demand. One call per check: it re-snapshots, so a second call shows this check's edits as already seen.

## Acting on an answer

**Read the answers out of the diff alone.** An added line under an `**Answer:**` marker is an answer; an edit inside a `Recommended` or a prose paragraph is the operator rewriting your draft, which is also an answer — their words win over yours. An empty slot is not an answer and never consent to the recommendation.

**Act as each answer lands when the action is reversible** — writing code, editing a file, drafting the next section. The operator watches the work follow their answers and can correct course while the rest of the file is still open.

**Hold until `DONE` when the action is hard to undo** — posting a PR review, sending a message, committing, publishing. A later report can carry a revised earlier answer; an answer acted on too early is already public.

## Ending the watch

The watch ends itself on `DONE` and on the review file being deleted. `TaskStop` its monitor task when the operator abandons the file, answers in chat instead, or the work the file fed is cancelled.

A prose file has no slots (`answered: 0/0`), so it never reaches `DONE`. It ends when the operator says they are finished, or when you stop it.
