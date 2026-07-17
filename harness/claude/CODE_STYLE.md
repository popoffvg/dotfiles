# CODE_STYLE — DDD

Write code Domain-Driven. Apply to any new module or refactor.

## Align language

- One term per concept across code, tests, docs, commits. No synonyms (`user`/`account`/`member` → pick one).
- Name types/methods after domain terms, not tech (`placeOrder`, not `insertOrderRow`).
- If domain and code disagree, rename code. Ubiquitous language wins.

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

## Layering

Organize by domain / vertical slice, never by technical kind. Forbidden: top-level `controllers/`, `services/`, `models/`, `repositories/` folders that split one feature across the tree.

- One folder per bounded context / feature. It owns everything for that slice: entities, value objects, events, command handlers, repo interface + impl, DTOs, mappers.

```
orders/                  ← vertical slice, self-contained
  order.entity           entity + invariants
  money.vo               value objects
  order-cancelled.event  events
  cancel-order.command   command + handler
  order.repository       interface + impl
  order.dto              boundary DTO + mapper
shipping/                ← another slice
billing/
shared/                  ← only cross-slice value objects / kernel
```

- Inside a slice, dependencies still point inward: entities/value objects/events depend on nothing; handlers orchestrate; repo impl and DTO mappers sit at the edge. Domain code imports no framework, no ORM, no transport.
- Slices talk via commands and events, not by reaching into another slice's entities or repo. No cross-slice imports except `shared/`.
- A change to one feature touches one folder.
