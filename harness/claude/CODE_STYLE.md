# CODE_STYLE

<when="naming anything — a type, a function, a field, a file, a test, a commit message">
## Align language

- One term per concept across code, tests, docs, commits. No synonyms (`user`/`account`/`member` → pick one).
- Name types/methods after domain terms, not tech (`placeOrder`, not `insertOrderRow`).
- If domain and code disagree, rename code. Ubiquitous language wins.
</when>

<when="the code holds a set of similar items plus a loop or switch that reads them — columns, fields, routes, menu entries, flags, steps">
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
</when>

<when="creating a file, module, or package — deciding where code goes, what the container is called, and what may import what">
## Domain module layout

Split code into modules named after domain concepts. "Module" is whatever the language groups files with — directory, package, namespace, crate, or single file for a small language. The rules below hold in every language; only the keyword changes.

**Name each module after the concept it owns, never after a technical role.** `ordering`, `billing`, `shipping` name concepts. `services`, `models`, `dto`, `utils`, `helpers`, `handlers`, `managers`, `core`, `common` name roles, so they collect code that shares no concept and grow without limit. One module holds one concept: its entities, its value objects, its repository interface, its commands, its events.

**The module-name test.** Read the top-level module names and nothing else. If they do not say what the system does, the layout is technical. Rename the modules after the concepts, then move each type to the module that owns its concept.

**The domain module imports no framework and performs no I/O.** Inside it: no HTTP router, no database driver or ORM, no serializer, no queue or cache client, no clock or filesystem call, no logger. The domain module depends only on the language standard library and other domain modules.

**The import test.** List every import in the domain module. Each framework or I/O import is one of two faults: a capability the domain must declare as an interface and receive from outside, or a type that belongs in a boundary module. Fix it as one of those two — never as an exception.

**Dependencies point inward: boundary → application → domain.** The boundary module (transport, persistence, UI) names the application module. The application module names the domain module. The domain module names neither. An inward-pointing graph lets the domain compile and test with no framework present, which is the check that the split is real.

**Every piece of a domain module has one name form and one home.** The table gives both. The behavior of each piece is in its own section below.

| Piece | Name form | Home | Never named |
| --- | --- | --- | --- |
| Aggregate root | domain noun — `Order` | domain module | `OrderModel`, `OrderData` |
| Entity inside the aggregate | domain noun — `OrderLine` | same module as its root | — |
| Value object | domain noun — `Money`, `EmailAddress` | domain module | `StringWrapper` |
| Repository interface | root name + `Repository` — `OrderRepository` | domain module, beside the root | `OrderDao`, `OrderStore` |
| Repository implementation | technology + interface name — `PostgresOrderRepository` | boundary module | — |
| Command | imperative verb + noun — `CancelOrder` | application module | `CancelOrderRequest` when it is not a wire type |
| Command handler | command name + `Handler` | application module | `OrderService` |
| Event | noun + past-tense verb — `OrderCancelled` | domain module, beside the emitter | `OrderCancelEvent` |
| Domain service | domain action — `FundsTransferService`, `PricingPolicy` | domain module | `OrderManager`, `OrderUtils` |
| DTO | boundary noun + boundary suffix — `OrderResponse`, `OrderRow` | boundary module | `Order` |

**An aggregate is one consistency boundary with one root.** Outside code holds a reference to the root only, and reaches inner entities through the root. One transaction changes one aggregate. A reference to another aggregate is its identity, not its instance, because two aggregates cannot share one transaction.

**The reachability test.** Find every place that holds a non-root entity of an aggregate. Each one either breaks the boundary — route it through the root — or proves the entity is a root of its own aggregate. Decide which, and move the type.
</when>

<when="writing a type that holds data — deciding whether it owns rules or only carries values across a boundary">
## Entity / DTO split

- **Entity** — owns domain logic. Enforces invariants in the constructor; no invalid instance exists. Mutates only through intention-revealing methods (`order.cancel()`, not `order.status = "cancelled"`). No public setters. No serialization/framework annotations.
- **DTO** — dumb data at the boundary (API, persistence, wire). Public fields, no behavior, no invariants. Maps to/from entities at the edge.
- Never leak DTOs into domain logic; never put behavior on a DTO. Map explicitly at the boundary.
- Value objects for concepts without identity (`Money`, `Email`, `DateRange`) — immutable, compared by value, self-validating.
</when>

<when="loading or persisting a domain object — any query, insert, update, or delete of state that outlives the process">
## Repository

- One repository per aggregate root. Interface declared in the domain layer; implementation in infrastructure.
- Collection-like API: `add`, `remove`, `findById`, `nextIdentity`. No `save`/`update` verbs — the repo persists the whole aggregate.
- Returns entities, never DTOs or ORM rows. Query/read models bypass repositories.
</when>

<when="the logic fits no single entity, or a type is about to take a Service / Manager / Helper name">
## Domain service

- Use only for logic that spans multiple aggregates or belongs to no single entity.
- Stateless.
- Not a home for logic that belongs on an entity — check the entity first. A service full of getters on one entity is a code smell (anemic domain).
</when>

<when="one request changes state, or another part of the system must react to a change">
## Command / event

- **Command** — imperative intent, may be rejected (`CancelOrder`, `ReserveStock`). Handler loads aggregate, calls one entity method, persists, emits events.
- **Event** — past-tense fact, immutable, never rejected (`OrderCancelled`, `StockReserved`).
- Entities emit events; handlers/side-effects subscribe. No cross-aggregate call inside a command handler — react via events.
- One command → one aggregate → zero or more events. Keep handlers thin; logic lives on the entity.
</when>

<when="writing or keeping a comment or a doc tag">
# DO NOT DO

- **NEVER** add links to the task or docs in the code. Code comments should reveal the unclear invariants or assumptions about external systems that code itself doesn't contain.

## The comment deletion test

Before keeping any comment, delete it, read the code under it, and name the fact you lost.

- No fact lost — the comment paraphrased the code. Delete it.
- A fact lost — keep that fact alone: an invariant, an assumption about another system, a unit or scale, a nullability rule, or an alternative that was rejected and why. Never what the code shows.
- Half a fact lost — keep the reason clause, drop the clause that narrates the code.

A doc tag stating only a parameter's name and its type restates the signature. Write the constraint on the value, or no tag.
</when>
