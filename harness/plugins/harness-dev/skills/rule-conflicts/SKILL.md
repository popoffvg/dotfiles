---
name: rule-conflicts
description: Find contradicting and duplicate rules across the instruction corpus — global CLAUDE.md, loose and plugin skills, ~/.notes/rules. Triggers on "find contradictions in the rules", "which rules conflict", "check the corpus for duplicates", and after a session broke a rule that another rule seemed to allow.
---

# Rule conflicts

A **conflict** is two rules that cannot both be obeyed in one situation. The script files each rule under its 2 nearest (artifact, aspect) labels; sonnet judges read each batch of groups whole. **Planted conflicts** are known pairs mixed into the corpus: the share the judges find is the run's recall, and a run without it proves nothing about a clean corpus.

1. **Group.** Run in the background `~/.claude/scripts/rule-conflicts.py group --out <scratchpad>/rule-conflicts --planted <this skill>/references/planted-conflicts.jsonl`. It needs Ollama with `qwen3-embedding:4b`. Done when it prints `batches` and `planted_pairs_in_one_group`. That count is a lower limit — a judge also pairs rules across the groups of its batch. Below 8/10, raise `--labels-per-rule` to 3 before you judge.
2. **Judge.** Start one `sonnet` agent per batch, all in one message, in the background. Fill `references/judge-prompt.md` — `<OUT>`, `<FILES>` (the batch from `batches.json`), `<BATCH>` (`batch1`, `batch2`, …) — into `<OUT>/prompt-<BATCH>.md`, and give each agent only "read that file and follow it". Done when every batch has a file in `judged/`.
3. **Report.** Run `rule-conflicts.py report --out <same dir> --planted <same file>`. Done when it writes `report.md`; a recall exit below 80% means the judge prompt misses conflicts, so fix the prompt before trusting the report.
4. **Hand over.** Give the operator `report.md` through the `to-user` skill. Each conflict carries the situation that breaks one rule, a proposed fix, and an empty `Decision:` line. Never edit a rule file here: the operator picks which rule stays.

A new planted pair goes in `references/planted-conflicts.jsonl` as `{id, a, b}`: two sentences on one artifact with opposite polarity, in the corpus's own style, matching no real rule.
