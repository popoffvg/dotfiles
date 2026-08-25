# Foundations — principles for every skill shape

Cross-cutting rules for authoring any skill, whatever its shape. Every shape guide assumes this vocabulary. Distilled from **writing-for-agents**: https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md

## The two loads

Every document and pointer you add spends one of two budgets, and the choice is always which one to spend.

- **Context load** — the cost of always-loaded material on the agent's window. A skill description sits there every turn, spending tokens and attention whether or not it fires.
- **Cognitive load** — the cost on the human: which skills exist and when to reach for each. The human is the index. Spend it where human judgement matters; it is the price of human agency, not a cost to minimise.

Material behind a pointer escapes context load for the price of the pointer's own line. Material with no pointer rides entirely on cognitive load.

## Information hierarchy

A skill is built from **steps** (the ordered actions the agent performs) and **reference** (definitions, rules, facts consulted on demand). The two mix freely. The core decision is which rung each piece sits on, ranked by how immediately the agent needs it:

1. **In-file step** — the primary tier: what the agent does, in order.
2. **In-file reference** — consulted on demand. Often a legitimately flat peer-set (every rule of a review on one rung); a fine arrangement, not a smell.
3. **Disclosed reference** — pushed into `references/<name>.md`, reached by a pointer, loaded only when the pointer fires.

**Progressive disclosure** is the move down the ladder so the top stays legible. Branching is the test: inline what every branch needs, disclose what only some branches reach. Push too little and the top bloats; push too much and you hide material the agent needs. Where a skill has steps, in-file reference that should be disclosed buries them and turns attending to them into a coin-flip — a variance lever, not just a tidiness one.

**Co-locate** what stays: a concept's definition, its rules, and its caveats under one heading, so reading one part brings its neighbours. Scattering fragments one meaning across the file; duplication repeats one meaning in two places. The test is whether the file reads like documentation written for the agent.

**Sprawl** is the failure here — a skill simply too long, even when every line is live and unique. Attention thins across the excess. Cure: disclose reference behind pointers, and split by branch or sequence so each path carries only what it needs.

## Frontmatter and invocation

Three fields settle before any shape is written.

- **name** — the skill's slug, and its leading word where it has one.
- **description** — a **context pointer**: it names material the agent does not hold and encodes the condition for reaching it. Its *wording*, not its target, decides whether the skill fires. It does two jobs — say what the material is, and list the **branches** that trigger it. It costs on every turn, so it prunes harder than the body: front-load the leading word, one trigger per distinct branch (synonyms renaming one branch are one branch written twice), and cut identity the body already carries. A must-have skill behind a weak pointer is a variance bug: sharpen the wording before inlining the material anywhere else.
- **invocation** — two independent axes, both default on (the user and the model can invoke; the description stays in context). Turn exactly one off when you want to restrict, and pay attention to which load you are spending:
  - `disable-model-invocation: true` → **user-only** `/` command. The description **leaves context**: zero context load, paid for in cognitive load, since you are now the index that must remember the skill exists. For side-effecting or timing-sensitive actions (`/deploy`, `/commit`) where you do not want the model choosing the moment.
  - `user-invocable: false` → **model-only**. Hidden from the `/` menu; the model fires it on the description, which **stays in context**. For background knowledge and captured lessons the user should not see as a command.

Frontmatter is parsed as YAML: a description containing a `:` followed by a space must be quoted, or the file fails to load. Source: https://code.claude.com/docs/en/skills (§ Control who invokes a skill).

## Completion criteria

Every step ends on a **completion criterion** — the condition telling the agent the work is done. Two properties make it a lever:

- **Checkable** — the agent can tell done from not-done. Not "review the models" but "every modified model appears in the change list".
- **Demanding** — how much it requires. "Every modified model accounted for" forces legwork that "produce a change list" does not. Demand is not step-bound: "every rule applied" binds a body of flat reference exactly as "every step done" binds a sequence, which is how an all-reference skill still carries an exhaustiveness bar.

**Premature completion** is the failure: the agent ends a step before it is genuinely done, attention slipping to *being done*, pulled by the steps still visible ahead. Defend in order — sharpen the bound first, since it is local and cheap; only when it is irreducibly fuzzy **and** you observe the rush, hide the later steps by splitting the sequence. Splitting works only across a real context boundary (a hand-off or a subagent dispatch); an inline call leaves the later steps in context and clears nothing.

## Leading words

A **leading word** is a compact concept already living in the model's pretraining that the agent thinks with while running the skill (*lesson*, *fog of war*, *tracer bullets*). Repeated as a token — never as a sentence — it accumulates a distributed definition and anchors a whole region of behaviour in the fewest tokens, by recruiting priors the model already holds. Coining your own works if you define it clearly, but a made-up word recruits no priors: you pay in definition tokens what a pretrained word gives free. Reach for an existing word first.

It anchors twice. In the body, *execution*: the agent reaches for the same behaviour every time the word appears. In the description, *invocation*: when the same word lives in your prompts, your docs, and your code, the agent links that shared language to the skill and fires it more reliably.

Hunt the passages that collapse into one token. Assume every skill carries restatements that leading words retire:

- "fast, deterministic, low-overhead" → *tight* — one quality restated across a phase, collapsed into a single pretrained word (a *tight* loop).
- "a loop you believe in" → *red* — a fuzzy gate turned into a binary observable state (the loop goes *red* on the bug, or it doesn't).

Place every leading word in `GLOSSARY.md` near the skill corpus.

**Prompt the positive.** Steering by prohibition drags the forbidden behaviour into context and makes it *more* available: *don't think of an elephant*, and the elephant is all there is. The negation is a weak modifier the strongly-activated concept overruns, so the ban half-reads as an instruction to do the thing. State the target behaviour ("write one-line comments") so the banned one is never spoken. Keep a prohibition only as a hard guardrail you cannot phrase positively, and even then pair it with the positive target.

## Pruning

- **Single source of truth** — each meaning has one authoritative home, so changing the behaviour is a one-place edit. **Duplication** costs maintenance and tokens, and inflates a meaning's prominence on the ladder past its real rank. (The accidental inverse of a leading word, which repeats a token on purpose, never the meaning.)
- **The environment is a source of truth too** — `package.json` scripts, config files, the directory layout, `--help` output. A skill restating it is a **cache**, earning its load only when the lookup is expensive. Cache the unwritten convention, the reason behind a choice, the gotcha no config confesses; leave the one-command lookups where they cannot go stale.
- **Relevance** — does the line still bear on what the skill does? A line loses relevance by never bearing on the task, or by going stale as the world it describes changes. Without a pruning discipline the default fate is **sediment**: stale layers that settle because adding feels safe and removing feels risky.
- **No-ops** — an instruction the model already obeys by default pays load to say nothing. Test each sentence in isolation: does it change behaviour versus the default? The test is model-relative, not reader-relative — two people disagreeing about a no-op disagree about the default, and settle it by running the skill, not by debate. When a sentence fails, delete the whole sentence rather than trim words from it. The test also grades leading words: a word too weak to beat the default (*be thorough*, when the agent is already thorough-ish) is a no-op, and the fix is a stronger word (*relentless*), not a different technique.

Deep pruning of an existing skill or corpus — the cross-file dedup map, the property and paragraph tests, the reshape pass — is the `prune-text` skill's job. Run it on a skill that has grown sediment.
