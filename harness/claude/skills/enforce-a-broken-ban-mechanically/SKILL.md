---
name: enforce-a-broken-ban-mechanically
description: Use when about to fix an agent's misbehaviour by adding or sharpening a rule in its prompt, and the prompt ALREADY carries that rule — the agent broke a written ban.
metadata:
  origin: self-improvement
---

**If the file already states the ban and the agent violated it, rewording the prose is spending the same failed lever twice.** Add the deterministic enforcement instead — a `PreToolUse` deny (or equivalent hook/gate) whose reason IS that sentence, so the ban executes instead of persuading.

Grounding example: a lint gate fired 15 `go test` invocations in one round despite its own prompt line saying not to. Prose alone had already failed once — the fix was a hook that blocks the tool call, not a stronger sentence.

**Decision cue:** prose for a rule never yet broken; mechanism for a rule broken once.
