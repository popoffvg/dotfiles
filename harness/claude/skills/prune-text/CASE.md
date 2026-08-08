# Cases

Cases this skill was abstracted from. Appended by capture-lesson Step 4; newest last.

## 2026-08-02 — Two cuts judged "default" were load-bearing, and only the eval said so

- **Repo:** `~/git/dotfiles`
- **Source:** discovery — Step 0 (an experiment produced it; no user statement)
- **Task:** Running `/prune-text capture-lesson` over `harness/plugins/self-improvement/skills/capture-lesson/SKILL.md`, whose Step 0 / Step 1 / Step 1b sections are extracted verbatim at run time by `evals/run.sh:37-38` and graded against 34 labelled cases.
- **What I did:** Applied Phase 2 Step 3 and cut two things as "default". (1) The failure clause in Step 1b — "It reads authoritative and is wrong half the time" — on the reasoning that the preceding sentence already stated the failure. (2) The artifact parentheticals in the Step 1 calibration list, keeping the six skill slugs but dropping `(lefthook.yml)`, `(model/src/index.ts)`, `(the harness/plugins/ layout)`, on the reasoning that the table row above defines the test.
- **User's words:** > none — the evidence is the eval score
- **Evidence:** Baseline `evals/README.md:56` = 32/34 joint. My three runs across the edits: 30/34, 32/34, 29/34. Each restore coincided with a score move, but `evals/README.md:58` records the same suite scoring 24 → 28 → 29 → 28 on identical configs — a ±3 band wider than any single paragraph's effect. **The per-cut attributions are therefore unproven.** What survives: restoring original text is the safe direction under an unresolvable measurement, and the two restored fragments were the concrete failure clause and the concrete artifact anchors, which is where a model-read gate carries its weight. See [[dont-game-the-metric]] Failure 4.
- **Ambiguous?** no — but the arbiter is the suite's spread, not one run.
- **Scope chosen:** global — the subject is compressing an instruction document that a model reads as a decision gate, not anything in this repo. `prune-text` already carries that trigger.
- **Rule written:** verdict — extended `prune-text`: a Phase 2 rule that a calibration list's weight sits in the artifact each example names, not in the names; and a Verify item requiring the grader to be run before and after when the pruned file drives an automated decision.
