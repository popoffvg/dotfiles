> A filled `$RESEARCH_DIR/<ep-slug>.questions.md` — the research agenda one `explorer` agent must
> answer. Copy the file, replace the questions, delete the `>` lines; each one states the rules for
> the section above it. The `grill-me` CLI call that generates it is `ref-grill.md`.
> **Every question is answerable by reading the code.** The reader is an agent with the repo, not a
> human — a question only a person could answer does not belong here.
> All seven sections below are required, in this order, and each one biases the explorer toward one
> step of the 6-step chain (`ref-artifact.md` § Result criteria).
> The artifact the explorer writes from these answers is `examples/research-artifact.md`; its
> `## Grill answers` section answers these questions in this order.
> The prose follows `harness-dev:text-style`.

# Grill agenda — anchor::reconcile

Entry point: `harness/apps/line-comment/server/src/anchor.rs:139` (`anchor::reconcile`)
Task context: decide whether the nearest-hash-match rule can be replaced without moving existing comments.

> The heading names the entry point, and the two lines under it are the only context the explorer
> gets that is not a question: the entry point as a `path:line` or a symbol, and the one-line task
> description that says which parts of the path matter.

## Intent / test questions (tests-first)

- Which tests exercise this path, and what behaviour does each one pin that the code must keep?
- Is any branch of the reconcile search UNTESTED — in particular the tie between two equally distant hash matches?
- Do the tests assert anything the implementation hides: a clamped line, a cleared orphan flag, an error message pinned verbatim?

> Chain step 2, and it comes first because tests state intent before implementation does. Ask which
> tests exist, which branch has none, and what the tests pin that the code does not say out loud.
> The section is wrong when it asks whether the code is well tested — that is a judgment, not a
> reading.

## Workflow-step questions

- What are the ordered atomic steps from `reconcile` being called to every comment of the file having a line and an orphan flag?
- For each step, what is the exact `path:line`, and which fields of the comment does it touch?
- Which callers reach this path, and does each one pass an open buffer's text or the text on disk?

> Chain step 1 and the material for `## 1. Workflow steps`. Ask for the happy-path order, the
> `path:line` of each step, and the state each step touches. A question about a step's *purpose*
> belongs in the intent section; this section asks what happens and where.

## Decision-point questions

- What does every `if`, `match`, and early return in this path branch on, which field does it read, and what does each branch do differently?
- Where does the path fork into two strategies — arithmetic shifting versus a whole-document hash search — and what decides the fork?
- What carries identity across the fork, so a comment shifted by arithmetic and a comment found by search end up in the same shape?

> Chain step 5 and the material for `## 2. Decision points`. Ask for the predicate and the field it
> reads, never just "what are the branches" — a branch with no named condition cannot become a `DP-N`
> row. Ask separately where the path forks into parallel strategies, because a fork is the branch an
> explorer most often reads past.

## Edge-case questions (adversarial)

- What happens when several lines of the document carry the same hash — a bare `}`, a blank line, a repeated `return nil`?
- What happens to a span whose first line moves while its body shrinks, or to a change that swallows the whole span?
- What happens when the anchored line points past the end of a shortened document, and can two comments end up on one line?
- What happens when the file is renamed or deleted while the editor is closed — is there any path that removes its comments?
- What happens when the stored JSON exists but cannot be parsed, and what does the next save write over it?

> Chain step 5, adversarial half, and the material for `## 5. Edge cases`. Assume the code has hidden
> complexity and name the specific hostile input: empty and single-element inputs, duplicate keys and
> key collisions, races and iteration-order non-determinism, partial failure mid-loop and whether
> anything rolls back, deleted or missing referenced resources, stale caches, encoder ambiguity, silent
> overwrites, and silent drops such as a `continue` on a missing field.
> A question phrased as "are edge cases handled?" is wrong — name the case and ask what happens.

## Identity & invariant questions

- What is "identity" at each layer — the store key, the comment's line, the hash — and how is equality defined at each?
- Which fields are mutable and which are locked after creation, and which of them is written to the JSON store despite being recomputed on every reconcile?
- Which fields take part in the conflict key that `upsert` uses, and which are only carried along?

> Chain step 3 and the material for `## 3. Identity / data carriers`. Ask for identity per layer and
> its equality rule, then for the mutable/locked split, then for which fields form the dedup or
> conflict key. Identity is where a silent overwrite hides, so an artifact that skips this section
> usually misses an edge case too.

## Refactor-hotspot questions

- Which surfaces couple several files, so a change to one forces a change to the others?
- Which contracts are implicit — the hash formula, the distance rule that breaks a tie, the sort order the callers depend on?
- Where would a future change most likely move an existing comment to the wrong line without any test failing?

> The material for `## 6. Refactor risks`. Ask where a change would cause a *specific* failure —
> silent data loss, a stale cache, a re-pointed reference — rather than where the code is complicated.
> The task context at the top of the file is what makes these questions sharp: they aim at the change
> the reader is considering.

## Surprises / gotchas

- What would a new contributor most likely get wrong about this path?

> One question, kept last, and it is the only one that invites the explorer to volunteer something the
> agenda did not ask for. It routinely surfaces the derived-versus-stored confusion, the field that
> looks sticky and is not, and the helper whose name says the opposite of what it does.
