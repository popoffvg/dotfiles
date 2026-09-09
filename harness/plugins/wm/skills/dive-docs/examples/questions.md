> A filled `$RESEARCH_DIR/<ep-slug>.questions.md` — the research agenda one `explorer` agent must
> answer. Copy the file, replace the questions, delete the `>` lines; each one states the rules for
> the section above it. The `grill-me` CLI call that generates it is `ref-grill.md`.
> Agenda generation rules are `references/ref-grill.md`; the result criteria are
> `references/ref-artifact.md` § Result criteria.
> The artifact the explorer writes from these answers is `examples/research-artifact.md`; its
> `## Grill answers` section answers these questions in this order.

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

> Tests-first rationale: `references/ref-artifact.md` § Result criteria.

## Workflow-step questions

- What are the ordered atomic steps from `reconcile` being called to every comment of the file having a line and an orphan flag?
- For each step, what is the exact `path:line`, and which fields of the comment does it touch?
- Which callers reach this path, and does each one pass an open buffer's text or the text on disk?

> This supplies the workflow-step artifact section; its contract is
> `references/ref-artifact.md`.

## Decision-point questions

- What does every `if`, `match`, and early return in this path branch on, which field does it read, and what does each branch do differently?
- Where does the path fork into two strategies — arithmetic shifting versus a whole-document hash search — and what decides the fork?
- What carries identity across the fork, so a comment shifted by arithmetic and a comment found by search end up in the same shape?

> This supplies numbered decision points; the artifact contract is
> `references/ref-artifact.md`.

## Edge-case questions (adversarial)

- What happens when several lines of the document carry the same hash — a bare `}`, a blank line, a repeated `return nil`?
- What happens to a span whose first line moves while its body shrinks, or to a change that swallows the whole span?
- What happens when the anchored line points past the end of a shortened document, and can two comments end up on one line?
- What happens when the file is renamed or deleted while the editor is closed — is there any path that removes its comments?
- What happens when the stored JSON exists but cannot be parsed, and what does the next save write over it?

> Name hostile inputs and their observed effect; the failure-path criterion is
> `references/ref-artifact.md` § Result criteria.

## Identity & invariant questions

- What is "identity" at each layer — the store key, the comment's line, the hash — and how is equality defined at each?
- Which fields are mutable and which are locked after creation, and which of them is written to the JSON store despite being recomputed on every reconcile?
- Which fields take part in the conflict key that `upsert` uses, and which are only carried along?

> Identity/data-carrier criterion: `references/ref-artifact.md` § Result criteria.

## Refactor-hotspot questions

- Which surfaces couple several files, so a change to one forces a change to the others?
- Which contracts are implicit — the hash formula, the distance rule that breaks a tie, the sort order the callers depend on?
- Where would a future change most likely move an existing comment to the wrong line without any test failing?

> Ask for concrete change failures, not complexity; see `references/ref-artifact.md` § Rules.

## Surprises / gotchas

- What would a new contributor most likely get wrong about this path?

> One question, kept last, and it is the only one that invites the explorer to volunteer something the
> agenda did not ask for. It routinely surfaces the derived-versus-stored confusion, the field that
> looks sticky and is not, and the helper whose name says the opposite of what it does.
