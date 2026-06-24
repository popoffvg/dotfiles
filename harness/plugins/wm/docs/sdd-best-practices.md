# Spec-Driven Development: best-practice audit (wm)

Research synthesis comparing this repo's `wm` workflow against external state-of-the-art
(humanlayer, plannotator, GitHub spec-kit, AWS Kiro, Anthropic). Source for the `spec` → `new` +
`impl-verify` additions and the `plan → spec` / `_notes → .notes` rename.

> Stored here (tracked) rather than `.notes/` because `.notes/` is gitignored runtime state.

## What this repo already does well

Flow: `research → spec → spec-verify → implement → verify → done` (agent-driven, no FSM).

| Practice | Where |
|---|---|
| Verification chain Type→Outcome→Terms→Changes→Autotest (human verifies a TODO without opening the repo) | `spec` → `todo` |
| Deepest-first layering (L0 leaf commits first; tree compiles after each commit) | `spec` → `write` |
| Pseudocode-first Changes (TS namespace, ≤40 lines, every side effect + error path visible) | `spec` → `flow` |
| One-commit-per-TODO; implementer never commits; one TODO per run | `impl` |
| Pairwise test design, tiered budgets (unit ≤12, integ ≤6, manual ≤4) | `test-set-create` |
| Test-honesty hard block (boundary changes can't claim "covered by unit tests") | `spec` → `verify` check E |
| Terms table as canonical vocabulary across spec.md + every TODO | `spec` |
| Documentarian research mindset + YAML frontmatter (git commit, branch, date, topic) | `explore research` |

This matches or exceeds humanlayer's `create_plan.md` on most axes.

## Gaps found → what we adopted

| Gap | Adoption | Source |
|---|---|---|
| No interactive interrogation of the spec before impl (`verify` is a static one-shot audit) | **`code new`** subcommand — grill-me loop over the spec decision tree; resolves decisions, empties Open Questions before READY | grill-me; humanlayer skeptical/interactive planning |
| Implementer self-reports pass/fail; no independent check of impl vs spec | **`impl-verify`** skill + **`verifier`** agent — adversarial LLM-as-judge, re-runs Autotest, writes `.notes/verify-TODO-N.md` (PASS\|DEVIATES) | humanlayer `validate_plan.md`; Spotify verification loops; LLM-as-judge |
| No explicit out-of-scope / unresolved sections in the spec | **What we're NOT doing** + **Open Questions** sections; `spec` → `verify` hard-blocks non-empty Open Questions | humanlayer `create_plan.md`; spec-kit; Kiro |

## External practices — ranked, with sources

### Spec-driven development methodology
- **Maturity levels** (Fowler/Böckeler): spec-first → spec-anchored → spec-as-source. https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- **GitHub spec-kit**: Specify → Plan → Tasks → Implement, acceptance tests at each gate. https://github.github.com/spec-kit/concepts/sdd.html
- **AWS Kiro**: Requirements (GIVEN/WHEN/THEN) → Design → Tasks. https://kiro.dev/
- **Good spec structure** (Addy Osmani): objective, user stories + acceptance criteria, constraints, architecture, data models, phased tasks, **open questions**. https://addyosmani.com/blog/good-spec/

### Research → Plan → Implement loop (humanlayer ACE)
- Three phases, each ending in an artifact that seeds the next; **intentional compaction** between phases keeps context at 40–60%. https://www.humanlayer.dev/blog/advanced-context-engineering
- Research command: documentarian mindset ("document what exists; do NOT critique"). Parallel sub-agents (codebase-locator/analyzer/pattern-finder). Frontmatter metadata via `spec_metadata.sh`.
- Plan command: read mentioned files FULLY before sub-tasking; skeptical + interactive; **no open questions in the final plan**; success criteria split **Automated** vs **Manual**; explicit **"What We're NOT Doing"**.
- `thoughts/` system: separate git-tracked notes dir, indexed for AI search. (This repo's analog: `.notes/`.)

### Agent spec verification
- Spec issues cause ~42% of agent failures → contract-based specs (preconditions/postconditions/invariants) eliminate them. https://tianpan.co/blog/2026-04-19-agent-task-specification-gap
- **Separate deterministic checks (tests/lint/build) from semantic/human review.** Spotify: deterministic verifiers → LLM-as-judge (vetoes ~25%) → staging telemetry. https://www.zenml.io/llmops-database/building-reliable-background-coding-agents-with-verification-loops
- **Independent/adversarial verifier** beats self-report; LLM judges agree with humans ~85%. Chain-of-thought + skeptical default improve accuracy. https://www.confident-ai.com/blog/why-llm-as-a-judge-is-the-best-llm-evaluation-method
- Anthropic evaluator-optimizer workflow; grader types (code-based / model-based / human); transcript + outcome grading. https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents

### Context engineering (Anthropic)
- Context is finite; "context rot" degrades recall as it grows. Techniques: compaction, structured note-taking (external files), sub-agent fan-out. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Keep CLAUDE.md / SKILL.md ~60 lines (200 ceiling) — longer gets deprioritized. https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

### plannotator (human-in-the-loop plan review)
- Browser review surface hooking `ExitPlanMode`: inline annotate (comment/strike/global), version diffs (`+N/-M`), structured feedback returned to the agent. Auto-saves every plan version to history. https://github.com/backnotprop/plannotator
- Transferable patterns: interception-as-integration (hook decision points), annotations as serializable metadata the agent parses, immutable version history as audit trail, layered prompt config with runtime overrides.

## Deferred (Tier-2 / Tier-3)

- **Intentional compaction note** at phase boundaries (research→spec→impl) — worklog.md exists; explicit reset guidance not yet written.
- **Contract-framed Outcomes** — make preconditions/invariants explicit where a TODO touches shared state.
- **plannotator** — evaluate as an external plugin install for human-in-the-loop spec annotation. No code change here.
