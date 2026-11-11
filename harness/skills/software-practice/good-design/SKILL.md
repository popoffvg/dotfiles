---
name: good-design
description: Write the change landscape before the first edit of a feature or a new mechanism — where the new code runs, the limits of that place, and the system numbers each design moves — and pick the design that moves them least. Use when you add a feature, a metric, a cache, a background job, a startup or init step, a migration, a new query, scan, or index, or a new field in a hot structure, and when the user says "think about the design", "what does this cost", "where does this run", "is this the right place".
---

# good-design

## Product

One run makes a **change landscape**: a short block written before the first edit, in the spec or plan when the task has one, else in the chat reply. Its readers are the agent, which writes code only for the chosen design, and the user, who rejects a design from the block before its code exists.

The block has three parts:

1. **Place.** One row per piece of new code: the component, the phase in which it runs, and how often that phase runs. A phase is one of: process start, per request or per call, per transaction or commit, per item of a collection, background loop, read by an external client (for example a scrape or a poll), shutdown.
2. **Limits.** For each phase in Place, the limits the system already has there, each with its source: a probe or timeout in the deploy config, a budget in a doc or an ADR, a test on time or size, a lock held in that phase, a comment that names the cost. Then how the repo does the same kind of feature now, with `file:line`.
3. **Designs.** A table with one row per design and one column per system number that has a limit in part 2, then a column for what the result loses. A system number is a quantity an operator or a user feels: start time, latency per call, memory, disk or DB reads per phase, lock time, series or key count, network calls. Each cell gives the cost as a term in a named size, for example `O(rows in <table>)` at start. The last row is the choice and its reason.

## Properties

A reviewer runs each check on one block:

- `phase-per-piece`: every piece of new code has a phase and a frequency.
- `limit-has-source`: every limit cites a `file:line`, a config value, or command output, or says "none found" after a named search.
- `neighbor-pattern`: the block names how the repo does the same kind of feature now, with `file:line`, or says the repo has none.
- `two-designs`: at least two designs, and one of them adds no work to process start and no I/O to a per-request or per-transaction phase.
- `cost-has-size`: every cost names the input it grows with and the real size of that input, with a source or marked "assumption" with its basis.
- `loss-stated`: each design says what its result cannot show or do, for example a value that resets on restart or a stale read.
- `choice-is-cheapest-or-argued`: the choice has the lowest cost on the numbers with a limit, or it quotes the task sentence that needs what the cheaper design loses.

## Cause

An agent makes the new feature exact and complete, and does not price what it costs the rest of the system. It reads only the code it changes, not the phase that code runs in, nor the limits on that phase. So it picks the design that reads all stored data at start, or adds I/O to every call, and moves a number the system already guards: a start-up probe, a latency budget, a lock. A cheaper design almost always exists: count at the moment of change instead of a scan, read at the client instead of at start, accept a stated loss. The landscape puts that design in the table before the choice.

A review after the code is the near alternative. It finds the cost after the agent wrote and tested the expensive design, when a rewrite costs the most. `good-design-kiss` asks whether a part is needed; this skill asks what a needed part costs where it runs.

## Steps

1. **Find the phase.** For each piece of new code, follow the caller chain up to its entry point: `main`, a module init, a request handler, a commit hook, a loop, a collector. Done when `phase-per-piece` passes.
2. **Find the limits.** Search the deploy config (probes, timeouts, resource limits), the docs and ADRs of the area, and the recent commits on the same phase (`git log -S` or `--grep` on its name). A recent commit that made a phase faster marks a number the team guards. Done when `limit-has-source` passes.
3. **Find the neighbor.** Find up to two places that do the same kind of feature, and read how they pay for it. Done when `neighbor-pattern` passes.
4. **Price the designs.** Write the design the task first suggests, then the design that moves the work out of the guarded phase. Get the real size of each input from production data, a test fixture, a doc, or the user. Done when `cost-has-size` passes.
5. **Choose.** When the cheapest design loses something the task may need, ask the user before the edit, with the loss in one sentence, and wait for the answer. Done when the block passes every property and the user answered each question.
6. **Verify blind.** After the last edit, follow `## For the caller` in `~/.claude/agents/good-design-verifier.md`, once per change for all good-design skills. When the code departs from the chosen design, update the block. Done when the verifier returns PASS or each finding is fixed or answered.

## Checks

The verifier runs these on the finished diff:

| Slug | Check | Evidence of a breach |
|---|---|---|
| `work-in-guarded-phase` | For each new call that reads storage, calls the network, or walks a collection, follow its callers to the entry point and name the phase. | It runs at process start, or per request, per call, or per commit, and its cost grows with stored data or collection size. The breach needs no known limit. The fix moves the work out of that phase, for example to a count at the change points, and states the loss. |
| `scan-for-a-trackable-value` | For each new value computed by a walk over a collection, look for the places that add to or remove from that collection. | The value could change by one at those places, and the diff walks the whole collection instead. |

A finding is not a breach only when a task sentence asks by name for what the cheaper design loses, for example "exact after a restart". A goal such as "make X visible" does not name it. Quote that sentence in the answer to the finding.
