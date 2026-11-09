---
name: simplify-code
description: Review the changed code for reuse, simplification, efficiency, and altitude cleanups, then apply the fixes. Quality only — it does not hunt for bugs; `/code-review` does that. A copy of the built-in `/simplify` that this repo owns. Use on `/simplify-code [<target>]`, "simplify the diff", "clean up the changed code without changing behavior". The read-only check of the same angles inside the wm review wave is the `wm:simplify-critic` gate.
argument-hint: "[<target>]"
---

# simplify-code

`/simplify-code → 4 cleanup agents in parallel → apply the fixes`

Improve the quality of the changed code. Do not hunt for bugs. Review the code for reuse, simplification, efficiency, and altitude issues, then fix what you find. Correctness bugs belong to `/code-review`.

## Phase 0 — Gather the diff

Run `git diff @{upstream}...HEAD` to get the unified diff under review. With no upstream, run `git diff main...HEAD` or `git diff HEAD~1`. When there are uncommitted changes, or the range diff is empty, also run `git diff HEAD` and include the working-tree changes: the review often runs before the commit. When the argument names a PR number, a branch, or a file path, review that target instead. This diff is the review scope.

## Phase 1 — Review (4 cleanup agents in parallel)

Start 4 independent review agents with the Agent tool, all in one message, so they run at the same time. Give each agent the diff and one angle of [references/angles.md](references/angles.md): Reuse, Simplification, Efficiency, or Altitude. Each agent returns its findings with `file`, `line`, a one-line `summary`, and the concrete cost: what is duplicated, wasted, or harder to maintain.

When the Agent tool is not available, review the diff against each of the four angles yourself, in one pass. Do not skip an angle. Say in the summary that this was a single-pass review without the 4-agent fan-out.

## Phase 2 — Apply the fixes

Wait for all four agents. Merge the findings that point at the same line or mechanism, and fix each remaining one directly. Skip a finding when its fix changes intended behavior, needs changes far outside the reviewed diff, or is a false positive. Note each skip, and do not argue with it. End with a short summary of what you fixed and what you skipped, or confirm that the code was already clean.
