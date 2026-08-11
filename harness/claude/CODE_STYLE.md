# CODE_STYLE 

## Align language

- One term per concept across code, tests, docs, commits. No synonyms (`user`/`account`/`member` → pick one).
- Name types/methods after domain terms, not tech (`placeOrder`, not `insertOrderRow`).
- If domain and code disagree, rename code. Ubiquitous language wins.

## Declarative table vs imperative reader

Split the two, and keep every per-item fact on the declarative side.

- **Declarative** — the facts about each item: its name, its type, its order, its membership in a subset, its per-item exceptions. One table, one row per item, each row complete.
- **Imperative** — the reader that turns a row into output. One path, no per-item knowledge. It merges no defaults, injects no fields, and consults no second list.

Two tests decide where a fact belongs.

**The table-diff test.** Change what ships and count the files edited. If changing *what* ships means editing the reader too, the fact belongs in a row. A diff of the table must be a diff of the behavior.

**The identity-branch test.** A branch in the reader keyed on one item's identity (`if id == "status"`) is a field missing from that row. Add the field; delete the branch.

A second array of ids that fixes order or membership is the common breach: two lists can disagree, one cannot. Where list position genuinely cannot carry the meaning — a subset shipping in its own order — give the row an explicit field and assert on duplicates and gaps. The forms this takes, and what to do when the ask itself names the shape, are in the `deliver-the-named-shape` skill.

Imperative stays imperative: sequencing, error handling, retries, and I/O are code, not table rows.

**Order the fields of a row by what identifies it.** The identifying field — `name`, the key, the id — goes first, then its type, then its qualifiers and metadata. A reader scanning a long table reads the first field of each row and nothing else, so the field that says *which item this is* has to be the one in that position. Copy field order from the domain, never from a neighbouring file that happens to lead with a type.

## Entity / DTO split

- **Entity** — owns domain logic. Enforces invariants in the constructor; no invalid instance exists. Mutates only through intention-revealing methods (`order.cancel()`, not `order.status = "cancelled"`). No public setters. No serialization/framework annotations.
- **DTO** — dumb data at the boundary (API, persistence, wire). Public fields, no behavior, no invariants. Maps to/from entities at the edge.
- Never leak DTOs into domain logic; never put behavior on a DTO. Map explicitly at the boundary.
- Value objects for concepts without identity (`Money`, `Email`, `DateRange`) — immutable, compared by value, self-validating.

## Repository

- One repository per aggregate root. Interface declared in the domain layer; implementation in infrastructure.
- Collection-like API: `add`, `remove`, `findById`, `nextIdentity`. No `save`/`update` verbs — the repo persists the whole aggregate.
- Returns entities, never DTOs or ORM rows. Query/read models bypass repositories.

## Domain service

- Use only for logic that spans multiple aggregates or belongs to no single entity.
- Stateless. Named after a domain action (`FundsTransferService`, `PricingPolicy`).
- Not a home for logic that belongs on an entity — check the entity first. A service full of getters on one entity is a code smell (anemic domain).

## Command / event

- **Command** — imperative intent, may be rejected (`CancelOrder`, `ReserveStock`). Handler loads aggregate, calls one entity method, persists, emits events.
- **Event** — past-tense fact, immutable, never rejected (`OrderCancelled`, `StockReserved`). Name in past tense.
- Entities emit events; handlers/side-effects subscribe. No cross-aggregate call inside a command handler — react via events.
- One command → one aggregate → zero or more events. Keep handlers thin; logic lives on the entity.

# DO NOT DO

- **NEVER** add links to the task or docs in the code. Code comments should reveal the unclear invariants or assumptions about external systems that code itself doesn't contain.

## The comment deletion test

Before keeping any comment, delete it, read the code under it, and name the fact you lost.

- No fact lost — the comment paraphrased the code. Delete it.
- A fact lost — keep that fact alone: an invariant, an assumption about another system, a unit or scale, a nullability rule, or an alternative that was rejected and why. Never what the code shows.
- Half a fact lost — keep the reason clause, drop the clause that narrates the code.

A doc tag stating only a parameter's name and its type restates the signature. Write the constraint on the value, or no tag.
