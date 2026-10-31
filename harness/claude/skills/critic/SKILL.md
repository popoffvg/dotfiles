---
name: critic
description: Find the blind spots of a plan or decision — the missed link in its reasoning, the unexpected consequence, the second-order effect — and hand them over as a `to-user` file. Use for "criticize this", "what am I missing", "poke holes", "red team this", "devil's advocate", "second-order effects".
argument-hint: [the plan or decision]
---

# critic — the blind spots of a plan

**Product.** One `to-user` file, `critic-<slug>.md`, with the blind spots of one plan or decision.

**Reader.** The owner of the plan. For each blind spot they change the plan, accept the risk, or reject the point.

**Properties** — the file MUST pass each one:

1. Each item is one blind spot of one kind: a **missed link** (a step the plan assumes and nobody checked), an **unexpected consequence** (something else the action changes), or a **second-order consequence** (what the first effect causes next).
2. Each item states its chain in plain words — plan step → what follows → why it hurts — with evidence the owner can check (`path:line` with a quote, a command and its output line, a source) and one concrete example.
3. Items are ranked by damage, at most 5. No item repeats a risk the owner already named.
4. An item that needs the owner's choice is a `[decide]` block with options and a recommendation; the rest are `[info]`. A candidate with no evidence goes under Not checked.
5. Every term is the owner's or the code's, or is glossed where it first appears.
6. The run changed nothing outside the scratchpad: no repo edit, no write to a memory store, MCP server, or remote. Reads, searches, and probes of any kind are allowed.
7. The file reaches the owner in one pass. A subagent runs only when a probe needs a clean context, and the file says why.

**Cause.** The owner calls `critic` to see what they did not think of. The old version ran up to three opus rounds in sequence, which was too slow to use, and handed over round tables and invented labels that hid the blind spots.

## Steps

1. **Fix the plan** in the file's Context: one sentence, the chain of steps the owner expects, and the sources it rests on. When the plan is unclear, ask through `to-user` and stop.
2. **Walk the chain.** At each step ask: what must be true here that nobody checked? What else does this action change? What does that change cause next? Settle each candidate with evidence — read, run, or probe — on the same model and data the plan targets.
3. **Hand over** the file through `to-user`, and stop. Applying a change is a separate request.
