---
name: draft
description: Use when the user runs "/draft <prompt>" or asks to draft/preview/dry-run how a prompt would be handled — reflect back the agent's reading of the prompt (intent, planned actions, limits) BEFORE acting, so misalignment surfaces first. Trigger on "draft this", "what would you do with", "before you act, tell me your plan", "how do you read this".
argument-hint: [the prompt to interpret — do not execute it]
model-invocation: false
user-invocation: true
---

# draft — reflect the read, don't act

Given a prompt, produce the agent's understanding of it. **Do not execute the task.** No edits, no tool runs beyond read-only lookups needed to ground the interpretation. Output is a mirror the operator corrects before real work starts.

The prompt is a sample, not a spec. Operators give one or two thin examples and expect the whole class handled ([[one-shot]] is the opposite: act when context is complete; here context is deliberately thin). Widen past the literal words: name the general task the examples stand for, the cases they imply but omit, the scope edge they gesture at.

## Output — three blocks, in order

### 1. Reading

- The literal ask, in one line.
- The implied ask: the class of work the example represents. State it wider than written. If the prompt says "rename this function", the class is "coordinated rename across all references + call sites + docs", not one edit.
- Assumptions the reading rests on. Each is a thing that, if wrong, changes everything below. Mark unverified ones `unverified`.
- Ambiguities: where the prompt admits two+ readings. Pick the one to run with, name the other.

### 2. Would do

- Ordered steps the agent would take — concrete: files, commands, tools, agents named.
- Extrapolate to the full set, not the examples. If given two files, glob the category and list all members that match (see [[exhaustion-condition]]).
- Where the plan branches on a fact not yet known, show the branch and how it resolves ("if X uses Y → path A, else path B").
- Verification step: how the agent would confirm the result, not just produce it.

### 3. Limits

- Scope edges: what stays untouched, and why that boundary.
- Where the agent would stop and ask instead of proceeding (hard-to-reverse, outward-facing, destructive, ambiguous-with-stakes).
- Permissions / environment it assumes present; flag any it can't verify.
- Failure modes: the ways this reading could be the wrong one — the traps a thin prompt hides.

## Rules

1. **Never act.** Read-only grounding only (locate a file, confirm a symbol). No writes, no side effects. If tempted to "just do it", stop — that is a different skill.
2. **Concrete over hedged.** Name the file, the count, the command. "several files" is a failure; `glob X → 7 files` is the standard (facts over evaluations, per STYLE).
3. **Widen, then bound.** Block 2 expands scope past the example; block 3 draws the line. Both are required — an unbounded read is as wrong as a too-literal one.
4. **Surface the fork, don't resolve it silently.** Every ambiguity gets named with the chosen branch, so the operator can flip it in one word.
5. **End with the single question** that, answered, would most sharpen the plan — or "none; ready to run" if the reading is tight.
