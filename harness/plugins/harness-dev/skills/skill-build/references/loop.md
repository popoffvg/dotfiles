# Skill shape: loop (repeat a flow)

Author a loop spec. Keep two layers apart: the **flow** is the work done once; the **loop** is the control that repeats it. The loop spec describes only the control — it names the flow, does not restate it.

A loop spec has exactly three parts. Resolve each before writing the artifact.

## 1. Flow

The procedure run once per iteration. Reference it, do not inline it.

- Name the flow (existing skill, command, or a documented step-sequence).
- State its single input and single output — the loop threads these.
- If the flow does not exist yet, stop and author the flow first; a loop over an undefined flow is unspecified.

## 2. Loop state

What carries across iterations. Without state a loop is just a `while true`.

- **Accumulator** — results gathered so far (list, set, count).
- **Cursor** — position in the work (index, page token, next item).
- **Seen** — dedup key set, so repeats don't re-enter.
- **Budget** — tokens/iterations/wall-clock remaining.

For each: name it, give its initial value, and state how one iteration updates it.

## 3. Stop criteria

When the loop exits. Name every exit; an unnamed exit is an infinite loop.

- **Done** — target reached (accumulator hits N, cursor exhausted).
- **Dry** — K consecutive iterations added nothing new.
- **Budget** — remaining hits zero.
- **Ceiling** — hard max iterations (backstop against runaway).
- **User** — explicit stop.

State which criterion is primary and which are backstops.

## Operating mode

- Resolve flow → state → stop, in order. Do not draft the artifact until all three hold.
- Push every control detail out of the flow and into the loop; push every work detail out of the loop and into the flow. Mixed layers = the defect this shape exists to prevent.
- For any state field or stop criterion the user leaves open, propose a default and mark it as an assumption.

## Output contract

Emit the loop spec:

1. **Flow** — name, input, output.
2. **Loop state** — each field: name, initial value, per-iteration update.
3. **Stop criteria** — each exit, primary vs backstop.
4. **Iteration** — one paragraph tracing a single cycle: read state → run flow → update state → check stops.
5. **Open assumptions** — defaults chosen for anything the user left unset.
