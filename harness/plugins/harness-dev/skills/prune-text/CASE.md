# Cases

## 2026-08-29 — Prune-text tested paragraphs but never asked whether a whole block should go

- **Repo:** `/Users/popoffvg/Documents/git/dotfiles`
- **Source:** method — the user stated how the pruning pass should work
- **Task:** Improving the `prune-text` skill's Phase 2.
- **What I did:** Phase 2 split lists and tables into rows and judged each row on its property, but only paragraphs got the "delete the whole thing" question. A table where every row failed still survived as a table.
- **User's words:** > improve prune-text: also you should challenge the parapgraph iteself, could you drop it at all
- **Evidence:** `harness/plugins/harness-dev/skills/prune-text/SKILL.md` — the paragraph test's cut classes (Framing, Restatement, Wrong reader, Sediment) already generalize to blocks; only the heading was paragraph-scoped.
- **Ambiguous?** no — the cut classes apply unchanged to a list or a table.
- **Scope chosen:** global — `prune-text` is a harness-wide skill used on any corpus.
- **Rule written:** verdict — widened the paragraph test to a block test covering paragraph, list, table, and section.
- **Transcript:** `~/.claude/self-improvement/lessons/harvested/2026-08-29-improve-prune-text-paragraph-challenge-b601001c-4d5a-4f1e-94f9-9b4cac8d67a5.jsonl`
- **Session topic:** improve prune-text paragraph challenge

## 2026-08-10 — session-cost-audit reduced 43→27 lines; user then widened the ask to all skills

- **Repo:** /Users/vitaliipopov/git/dotfiles
- **Source:** method — the user stated how skills are authored in this harness
- **Task:** Reduce and generalize the session-cost-audit skill; then the whole skill corpus
- **What I did:** The skill I had written enumerated the companion script's JSON fields, carried a repo-specific lever table, and repeated "Done when" per step
- **User's words:** > I want to reduce and generalize skill as possible. […] and after merge skill as possible
- **Evidence:** haiku analysis of session-cost-audit: steps 1–2 and 5 restated doctor-session-cost.py output fields; lever table rows were dotfiles-specific; steps 3+6 duplicated the same mapping work
- **Ambiguous?** no — one right answer: cut what the tools teach, keep what they cannot
- **Scope chosen:** global — skill authoring recurs on every capture and every harness edit
- **Rule written:** verdict — a SKILL.md keeps only what running the tools cannot teach; repo tables become the principle they encode
- **Transcript:** ~/.claude/projects/-Users-vitaliipopov-git-dotfiles/3f09d27e-8e01-4e53-ac34-02a7e0ae01b2.jsonl
- **Session topic:** reduce and generalize the Claude skill corpus
