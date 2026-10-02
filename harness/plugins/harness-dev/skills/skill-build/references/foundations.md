# Foundations — what every shape needs

The shared vocabulary — information hierarchy, co-location, completion criteria, leading words, positive targets, the description as a context pointer — is the `text-style` skill (`harness-dev` plugin). Read it once; the shape guides use its words bare. This file holds only what `text-style` leaves out. Distilled from **writing-for-agents**: https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md

## The two loads

Every line and pointer spends one of two budgets.

- **Context load** — always-loaded material on the agent's window. A skill description sits there every turn, whether or not it fires.
- **Cognitive load** — the human remembering which skills exist and when to reach for each. Spend it where human judgement matters; it is the price of agency, not a cost to minimise.

Material behind a pointer escapes context load for the price of the pointer's line. Material with no pointer rides on cognitive load.

## Frontmatter and invocation

- **name** — the slug, and the leading word where the skill has one.
- **description** — a context pointer; `text-style` → Write the description last.
- **invocation** — two axes, both on by default (user and model can invoke; the description stays in context). Turn off at most one:
  - `disable-model-invocation: true` → user-only `/` command. The description **leaves context**: zero context load, paid in cognitive load. For side-effecting or timing-sensitive actions (`/deploy`, `/commit`).
  - `user-invocable: false` → model-only. Hidden from the `/` menu; fires on the description, which **stays in context**. For background knowledge and captured lessons.

YAML parses the frontmatter: a description with `: ` inside must be quoted, or the file fails to load. Source: https://code.claude.com/docs/en/skills (§ Control who invokes a skill).

## Pruning

- **Single source of truth** — one home per meaning, so a behaviour change is a one-place edit. Duplication inflates a meaning's rank on the hierarchy. (A leading word repeats a token on purpose, never the meaning.)
- **The environment is a source of truth** — `package.json` scripts, config, the directory layout, `--help`. A skill restating it is a **cache**, worth its load only when the lookup is expensive. Cache the unwritten convention, the reason behind a choice, the gotcha no config confesses.
- **No-ops** — a sentence the model already obeys by default. Test each sentence alone: does it change behaviour? The test is model-relative; settle a dispute by running the skill. Delete the whole sentence, never trim words from it. A leading word too weak to beat the default (*be thorough*) is a no-op; the fix is a stronger word (*relentless*).
- **Sediment** — stale layers that settle because adding feels safe and removing feels risky. Cross-file dedup and the reshape pass are the `prune-text` skill's job.
