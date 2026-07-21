# Foundations — principles for every skill shape

Cross-cutting rules for authoring any skill, whatever its shape (`workflow`, `loop`, `instruction`). Distilled from **writing-great-skills**: https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-great-skills/SKILL.md

## Pruning

Keep each meaning in a single source of truth: one authoritative place, so changing the behaviour is a one-place edit.

Check every line for relevance: does it still bear on what the skill is for?

Then hunt **no-ops** sentence by sentence, not just line by line: run the no-op test on each sentence in isolation, and when one fails, delete the whole sentence rather than trim words from it. Be aggressive — most prose that fails should go, not be rewritten.

## Leading words

A **leading word** is a compact concept already living in the model's pretraining that the agent thinks with while running the skill (e.g. *lesson*, *fog of war*, *tracer bullets*). Repeated through the skill (though not necessarily — a strong leading word might only be needed once), it accumulates a distributed definition and anchors a whole region of behaviour in the fewest tokens, by recruiting priors the model already holds.

It serves predictability twice. In the body it anchors *execution*: the agent reaches for the same behaviour every time the word appears. In the description it anchors *invocation*: when the same word lives in your prompts, docs, and code, the agent links that shared language to the skill and fires it more reliably.

Hunt for opportunities to refactor a skill to use leading words. A triad spelled out at three sites (**duplication**), a description spending a sentence to gesture at one idea — each is a passage begging to collapse into a single token. Examples:

- "fast, deterministic, low-overhead" → *tight* — one quality restated across a phase, collapsed into a single pretrained word (a *tight* loop).
- "a loop you believe in" → *red* — converts a fuzzy gate into a binary observable state (the loop goes *red* on the bug, or it doesn't).

You win twice: fewer tokens, and a sharper hook for the agent to hang its thinking on. Assume every skill carries restatements that leading words retire — go find them.

Place every leading word in `GLOSSARY.md` near the skill corpus.

## Failure modes

Use these to diagnose issues the user may be having with the skill.

- **Premature completion** — ending a step before it's genuinely done, attention slipping to *being done*. Defence, in order: sharpen the completion criterion first (cheap, local); only if it is irreducibly fuzzy **and** you observe the rush, hide the post-completion steps by splitting (the sequence cut).
- **Duplication** — the same meaning in more than one place. Costs maintenance and tokens, and inflates a meaning's prominence on the ladder past its real rank.
- **Sediment** — stale layers that settle because adding feels safe and removing feels risky. The default fate of any skill without a pruning discipline.
- **Sprawl** — a skill simply too long, even when every line is live and unique. Cure: disclose reference behind pointers, and split by branch or sequence so each path carries only what it needs.
- **No-op** — a line the model already obeys by default, so you pay load to say nothing. Test: does it change behaviour versus the default? A weak leading word (*be thorough*, when the agent is already thorough-ish) is a no-op; the fix is a stronger word (*relentless*), not a different technique.
- **Negation** — steering by prohibition backfires: "don't think of an elephant" names the elephant and makes it more available. Prompt the **positive** — state the target behaviour so the banned one is never spoken; keep a prohibition only as a hard guardrail you can't phrase positively, and even then pair it with what to do instead.
