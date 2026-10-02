# Skill shape: loop (repeat a flow)

Two layers stay apart: the **flow** is the work done once; the **loop** is the control that repeats it. The loop spec names the flow and leaves the flow to state itself. Mixed layers are the defect this shape exists to prevent.

## 1. Flow

Name it — an existing skill, a command, or a documented step sequence — with its single input and single output. A loop over an undefined flow is unspecified: author the flow first.

## 2. Loop state

What carries across iterations. For each field: name, initial value, per-iteration update.

- **Accumulator** — results gathered so far.
- **Cursor** — position in the work.
- **Seen** — dedup key set.
- **Budget** — tokens, iterations, or wall-clock remaining.

## 3. Stop criteria

Name every exit — an unnamed exit is an infinite loop. Mark one primary, the rest backstops.

- **Done** — target reached.
- **Dry** — K consecutive iterations added nothing.
- **Budget** — remaining hits zero.
- **Ceiling** — hard max iterations.
- **User** — explicit stop.

## Output

The loop spec: flow (name, input, output); loop state; stop criteria; one paragraph tracing a cycle — read state → run flow → update state → check stops; and the defaults chosen for anything the user left open, marked as assumptions.
