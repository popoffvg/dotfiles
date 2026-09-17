---
name: session-cost-audit
description: Audit why a Claude Code session was slow or expensive, and rank fixes onto existing harness levers. Triggers on "make sessions faster", "why did that session burn so many tokens", "where did the context go", "analyse this transcript", "too many turns per prompt", or any ask to profile a .jsonl under ~/.claude/projects.
---

# Session cost audit

Measure one transcript, then rank fixes. A hypothesis without a measured number is not a finding.

Two words carry the audit:

- **rework** — a segment the operator opened by restating a rule the harness already states. Pure waste: the rule existed, the run ignored it.
- **static floor** — the context every request pays before any work (system prompt, tool schemas, skill and agent listings). Paid once per request, so it multiplies.

## Steps

1. **Run the auditor.** `~/.claude/scripts/doctor-session-cost.py <transcript.jsonl|project-name>` (`--latest` picks the newest session) prints one self-describing JSON report. Record `wc -l` on the transcript — a live session appends while the audit runs. Related attribution scripts: `doctor-skill-listing-cost.py`, `doctor-user-skill-usage.py`.

2. **Label the segments.** For every segment above the median `reqs`: label it work or **rework**. A rework segment corrects naming, removes something, or repeats an instruction. For each rework segment, grep the harness rule files (`~/.claude/CLAUDE.md`, loose skills, plugin skills) and cite the `file:line` that already stated the rule — or reclassify it as genuine new intent.

3. **Quantify the waste fields.** Walk the rest of the report — static floor share of `cache_read`, repeated blocking hooks, largest tool results, reread/rewritten files, subagents, compactions, wall clock span versus active. Each field becomes a finding with a number, or is noted clean.

4. **Map each finding to an existing lever.** A new mechanism loses to a file already wired in: a hook that can block the mistake, a settings entry that can shrink the floor, a skill or agent that already owns the phase where the waste happened. Name the lever's file for every finding; only mark a finding "needs new mechanism" with the reason.

5. **Give each hypothesis a test.** Name the report field that must change, the direction, and the target value.

Output: the numbers table first (each row with the command that produced it), hypotheses after. Anything the transcript does not hold — latency, dollars, why a gap was idle — is `unmeasured`, never estimated.
