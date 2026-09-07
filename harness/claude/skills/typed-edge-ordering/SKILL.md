---
name: typed-edge-ordering
description: Use when implementing or reviewing a topological sort, dependency ordering, layering, or DAG traversal over a graph whose edges carry different relation types (e.g. depends / derived / references / refresh / see-also). Prevents false cycles and wrong orders from counting non-prerequisite edges.
---

Only **true-prerequisite** edges may constrain the order. An edge orders A before B *only if* B's correctness/existence genuinely requires A first ("must-precede"). Every other relation type — renditions, refresh/drift links, see-also, back-references, annotations — is **not** an ordering constraint; excluding it is the correct default, not an oversight.

Counting a non-prerequisite edge as an ordering edge is the classic bug: it manufactures **false cycles** (two atoms each "require" the other when really one is just a rendition of the other) and scrambles the order.

Procedure:
- Before writing the traversal, enumerate the edge types and classify each: **orders** (prerequisite) vs **does-not-order**. Filter to the ordering set at graph-build time.
- Do not treat "the field lists a target" as "the target must precede." Direction and type both matter — a `derived-from` / `rendition-of` edge points at a source but is not a prerequisite.
- A reported cycle among prerequisite edges is a **data/content problem** (a real circular dependency), not a numbering one — surface it, don't silently break it.
- Dry-run the ordering against real data before applying an auto-reorder; a cycle or surprising permutation means the edge classification is wrong or the data is.

When unsure whether an edge type should order, ask — the classification is a design decision, not a default to guess.
