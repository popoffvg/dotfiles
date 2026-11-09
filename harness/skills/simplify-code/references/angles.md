# Cleanup angles

The four angles of the `simplify-code` skill. The `wm:simplify-critic` gate runs the last three: the `reuse-critic` gate owns Reuse. Each finding has `file`, `line`, a one-line `summary`, and the concrete cost: what is duplicated, wasted, or harder to maintain.

## Reuse

Flag new code that re-implements something the codebase already has. Grep the shared and utility modules and the files next to the change, and name the existing helper to call instead.

## Simplification

Flag unnecessary complexity that the diff adds: redundant or derivable state, copy-paste with slight variation, deep nesting, dead code left behind. Name the simpler form that does the same job.

## Efficiency

Flag wasted work that the diff adds: redundant computation or repeated I/O, independent operations that run in sequence, blocking work added to startup or to hot paths. Also flag long-lived objects built from closures or captured environments. They keep the whole enclosing scope alive for the life of the object, which is a memory leak when that scope holds large values. Prefer a class or a struct that copies only the fields it needs. Name the cheaper alternative.

## Altitude

Check that each change fixes the root cause at the right depth, and does not patch a symptom with a fragile workaround. Special cases on shared infrastructure show that the fix is not deep enough. Prefer the simpler, more general change to the underlying mechanism over more special cases, and name that change.
