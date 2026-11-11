---
name: state-machine
description: "state-machine: the rules for which states a state machine has, how each state resolves, and how states and enum terms are named. Use when you design or review a state enum or a transition table, or find a state that has no answer after a restart."
---

# state-machine — a state is what a restart finds

Apply every rule below to each state, each enum term, and each transition before you show the machine to the operator. A worked case, a rollout machine cut from 12 states to 4, is `references/rollout-example.md`.

A formal model is optional. Load `references/quint.md` only when the user asks for a Quint model of the machine.

## The restore test

**Ask of each state: "After a crash and a restart, what do I see?"** A state exists only when the store holds a record that tells a restart it is in this state. A crash in a state that has written nothing leaves nothing to restore, so that state is not a state.

- A window between a read and a write (read the record, then save it) is a **step** of the engine inside a state, not a state of the machine. Name it in the step enum (`EngineStep.Claiming`).
- An idle or "before anything" state is the absence of a record. Do not model it as a state.
- Two states that a restart cannot tell apart from the store are one state.

## One state per behavior

**Keep a state only when some guard or action reads it and does something different.** Before you add a state, grep for the guards that read it. If no guard branches on it, it is payload, not a state.

- Do not replace a removed state with a flag. If "drives" and "watches" differ, derive the difference from the stored facts at each step (the cause, the stored marker, the owner lease). A derived predicate changes by itself when the facts change, so it needs no transition.
- Terminal states that the machine treats the same way (all go back to the list) are one terminal state with a payload. Show the operator the cost (weaker test assertions) before you collapse them.
- A fact about the store (a record is held) lives in the store and is read from it. Do not copy it onto the state.

## Every state resolves

**No state parks without an answer.** Do not add a catch-all state that records doubt (`Unknown`, `OutcomeUnknown`). Where the machine cannot tell yet what happened, it reads the store and the provider again. Give each cause of doubt its own resolution:

| Doubt | Resolution |
| --- | --- |
| The observation failed (network, timeout) | Keep the state. The next observation replaces it. End only when the retry budget is spent. |
| Another owner holds a live lease | Wait for the owner's action or for the lease to expire, then read again. |
| A conditional write was stale | Read the record again and continue from what is there, or end if it is gone. |
| A stored marker is unreadable | Read it as no marker. The machine loses the right to resume, not the right to observe. |

- **One kind has one meaning.** If one kind covers a recoverable cause and a fatal cause, split it. The fatal rule must not fire on the recoverable cause.
- **Every block considers time.** A guard that refuses because a record is held also asks whether the owner's lease is live. A dead owner must not block the operator forever.
- **Wait with a condition, not with a hand loop.** A blocking wait for a state is an option of the observer (`WaitUntil(condition)`), with the same retry policy. Do not write a second poll loop with its own sentinel error.

## Names

**Name the state of the machine, not what happens to a side object.** The name describes the type that holds it: a `RolloutState` term describes the rollout, not the record the rollout writes.

- Use the "-ing" form for a state in progress (`Deploying`, `Clearing`). Use a terminal word for an end (`Done`, `Refused`).
- If the operator asks "what does X mean?", the name fails. Rename it.
- One word has one meaning across all enums of the machine. `settle()` must not collide with the stage state `Settled`, and `stageDone()` must not collide with the rollout state `Done`.
- A check uses the same word as the field it reads (`noUnaskedCreate` reads `unaskedCreate`).
- A switch names the rule it enables, not a state that no longer exists (`RejoinSendsNoCreate`, not `RejoinOnlyObserves`).

## Enum terms

**Every enum term is written and read.** Count the real uses of each term, without comments and declarations.

- A term that is written and never read (`NoCause`, `NoResult`) shows a missing type. Put the payload on the variant (`Deploying(Cause)`, `Done(Result)`), so a flat record does not need a filler value.
- Remove a dead term by fixing the behavior that produced it, not by deleting the line from the enum.
- A term that is produced and that no test asserts is a test gap. Add the test.

## Each state's document

Document each state in the declarative table with three parts. Keep the transitions in the same row, so the reader holds no per-state knowledge.

- **Situation:** what happened before the machine came to this state.
- **Must:** what the machine does in this state.
- **Store holds:** the record in the store while the state holds.

## Tests

- A fake must be able to produce each failure the machine handles (a failed describe, a stale write). If the fake cannot fail, no test can reach the failure path, and a green suite proves nothing.
- Mutation-check each new test: put the old line back, see the test fail, then restore it.

## Completion

The machine is ready when each state passes the restore test, each state has a guard that reads it, no state parks, each name is clear without a question, and each enum term is read.
