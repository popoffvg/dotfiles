---
name: tactical-design
description: >
  Tactical design principles for the code level (C4 level 4) — types, interfaces, functions, and the
  fields and branches inside them. Use when designing the types or interfaces of a change, when a spec
  or a diff extends an existing type — a new field, method, parameter, kind branch, a second store
  or reader of a record, or a new method beside an existing one — when the
  user asks whether an abstraction fits, and when choosing between vertical slice, hexagonal
  (ports and adapters), and a DDD split into bounded contexts for a package.
---

# Tactical design

Principles for the code level: types, interfaces, functions. Apply them to every change that extends an existing type, not only to a new type. To judge a design or a diff, list every type, interface, port, record, and table it creates or changes, and check each one against every principle. Cite a breach by the principle name.

## Principles

### Conceptual integrity

**A new need is a new instance, not a new exception** — never a field or a branch inside a type that exists.

### One name, one job

**A type name is true for every need the type serves.** When the name is false for one need, that need goes to another type. When the one-line description of a type needs "and", it is two types. Known as the Single Responsibility Principle.

### Stable field meaning

**A field carries one fact, every instance fills it, and a change keeps its meaning.** A field that only one kind of need fills, or a field that exists only to restore the old meaning of another field, shows a broken concept. Put the new fact in a new instance or a new abstraction.

### A copy reads back whole

**A copy of a record in a second store reads back as the full record type** — not the same type with fields left zero, and not a second, smaller type. State fields say where the entity is (a phase, a generation, a snapshot). Write fields say how one copy was written (the format version, the write time, the object version). The second store keeps the state fields. The read fills each write field it does not keep from a constant, or leaves it zero and the field comment says so. Two copies are compared by the state fields only, in a method named for that (`SameInstanceState`). Never name it `Equal`: go-cmp calls `Equal` on its own, and a method that skips a field hides a real difference in every test.

### Wrap shared behavior

**Behavior that many instances need wraps an instance.** Logging, auth, retry, and timeouts are middleware or a decorator, not code inside each instance. Known as the Decorator pattern.

### Follow the local pattern

**A new instance copies the structure of the instances that exist** — the constructor shape, the method set, the file layout. When the request says "do X like Y", copy Y from the real code, not a better variant of it.

### One way per job

**The codebase does one job in one way** — one way to read a state, one way to start a run. Search the codebase for the job before you accept a second way. A new method that calls an existing private read and returns one field of its result is a second way: make the existing read public, with its result type, and delete the new method. Known as DRY.

### Change the abstraction, not the need

**When a need does not fit, make the change easy, then make the easy change** (Kent Beck). A need does not fit when another principle fails for it. Choose one fix and name it: widen the contract and move every existing instance to it, or give the need its own abstraction.

## Architecture styles

Pick the style of each package before you design its types. Name the style in the design, and follow the package that exists when it already has one (Follow the local pattern). One repo can use all three: a slice per use case, a port at each external system, a bounded context per domain language.

| Style | What it means | Use when | Tactical patterns | Do not use when |
|---|---|---|---|---|
| **Vertical slice** | One folder per use case or command. It holds the handler, the request and response types, the query, and the tests. Slices share no code but a thin base (DB handle, logger). | Many use cases with little shared logic: CRUD endpoints, CLI subcommands, reports. Each change touches one use case. | A request type and a response type per slice. One handler function. The query sits in the slice, not in a shared repository. Duplicate across slices until the third copy, then extract (One way per job). | The use cases share invariants on one entity: a slice per use case then copies the rule into each slice. |
| **Hexagonal (ports and adapters)** | The core holds the logic and declares a port (an interface) for each external system it needs. An adapter implements the port for one technology (S3, GCS, a local FS, a DB). The core imports no adapter. | One logic runs against two or more back ends, or a back end must be faked in tests: a store over S3 and GCS, a clock, an external API. | The port is an interface owned by the core, named for the need (`ObjectFS`), not for the technology. One adapter type per technology. A contract test runs every adapter. The constructor takes the port. | One back end and no fake: the port then has one implementation and only adds a layer. |
| **DDD split (bounded contexts)** | The domain splits into contexts, each with its own language, its own types, and its own store. A term means one thing inside a context. Contexts talk through a published contract, translated at the edge. | The same word means different things to different parts of the system, or two teams or processes own different rules: an instance record in the bucket and in the DB, a snapshot for the housekeeper and for the restore tool. | An aggregate per consistency rule, changed only through its root. A value object for each typed value (`SnapID`). A domain event or a record at the context edge. A translation at the edge, not a shared struct (A copy reads back whole). | One language and one team: the split then adds translation code with no second meaning to protect. |

Decide in this order:

1. Does a term mean two things, or do two owners hold different rules? Split into bounded contexts first.
2. Inside a context, does the logic run against an external system that changes or needs a fake? Put a port there.
3. Inside the rest, are the use cases independent? Make one slice per use case.
