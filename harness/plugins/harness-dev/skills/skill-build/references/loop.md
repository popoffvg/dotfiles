# Skill shape: loop (repeat a flow)

Author a loop spec. Two layers stay apart: the **flow** is the work done once; the **loop** is the control that repeats it. The loop spec describes only the control — it names the flow and leaves the flow to state itself. Shared vocabulary: `foundations.md`.

Three parts, resolved in order. The artifact is written once all three hold.

## 1. Flow

The procedure run once per iteration, referenced rather than inlined.

- Name the flow — an existing skill, a command, or a documented step-sequence.
- State its single input and single output; the loop threads these.
- Where the flow does not exist yet, author the flow first. A loop over an undefined flow is unspecified.

## 2. Loop state

What carries across iterations. State is what separates a loop from a `while true`.

- **Accumulator** — results gathered so far (list, set, count).
- **Cursor** — position in the work (index, page token, next item).
- **Seen** — dedup key set, so repeats stay out.
- **Budget** — tokens, iterations, or wall-clock remaining.

For each: name it, give its initial value, and state how one iteration updates it.

## 3. Stop criteria

When the loop exits. Name every exit — an unnamed exit is an infinite loop.

- **Done** — target reached (accumulator hits N, cursor exhausted).
- **Dry** — K consecutive iterations added nothing new.
- **Budget** — remaining hits zero.
- **Ceiling** — hard max iterations, the backstop against runaway.
- **User** — explicit stop.

State which criterion is primary and which are backstops.

## Operating mode

Push every control detail into the loop and every work detail into the flow; mixed layers are the defect this shape exists to prevent. For any state field or stop criterion the user leaves open, propose a default and mark it as an assumption.

## Output contract

Emit the loop spec:

1. **Flow** — name, input, output.
2. **Loop state** — each field: name, initial value, per-iteration update.
3. **Stop criteria** — each exit, primary vs backstop.
4. **Iteration** — one paragraph tracing a single cycle: read state → run flow → update state → check stops.
5. **Open assumptions** — defaults chosen for anything the user left unset.
