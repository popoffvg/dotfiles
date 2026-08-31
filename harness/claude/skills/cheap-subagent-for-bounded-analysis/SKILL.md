---
name: cheap-subagent-for-bounded-analysis
description: Use when a task contains a bounded read-and-report analysis subtask — audit a file, profile a transcript, summarize a diff, triage a list — and you are about to do it inline with the main (expensive) model. Delegate it to a haiku subagent instead.
metadata:
  origin: self-improvement
---

**Delegate a bounded read-and-report analysis to a haiku subagent; keep the main model for synthesis and edits.** A subtask qualifies when its inputs are named files, its output is a structured report, and no editing or judgment about the wider task is required. Launch one `general-purpose` agent with `model: haiku`, give it the exact files and the report shape, and act on its findings with the main model.

Failure this prevents: the main model burns its own context and tokens scanning files line by line, when a cheap agent returns the same structured findings for a fraction of the cost.

When the analysis needs cross-task judgment (design trade-offs, ambiguous evidence), keep it on the main model — the rule covers mechanical read-and-report work only.

**Do the deterministic extraction yourself; delegate only the reading.** A cheap agent asked to both build a corpus and analyze it spends its run on the filter and returns nothing. Write the extraction as a script, run it, verify the output looks right, then hand the finished file to the agent with the record count stated.

**Re-check every number the cheap agent reports before relaying it.** Counts, frequencies, and "N occurrences" claims from a small model are frequently invented. One `grep -c` per headline number is enough, and a claim that does not survive it must be dropped, not softened. The agent's prose findings can still be right when its arithmetic is wrong.
