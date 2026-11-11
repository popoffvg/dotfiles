# Architecture styles

Pick the style of each package before you design its types. Name the style in the design, and follow the package that exists when it already has one (`good-design-kiss`: copy the local pattern). One repo can use all three: a slice per use case, a port at each external system, a bounded context per domain language.

| Style | What it means | Use when | Tactical patterns | Do not use when |
|---|---|---|---|---|
| **Vertical slice** | One folder per use case or command. It holds the handler, the request and response types, the query, and the tests. Slices share no code but a thin base (DB handle, logger). | Many use cases with little shared logic: CRUD endpoints, CLI subcommands, reports. Each change touches one use case. | A request type and a response type per slice. One handler function. The query sits in the slice, not in a shared repository. Duplicate across slices until the third copy, then extract (`good-design-dry`: extract new shared code at the third copy). | The use cases share invariants on one entity: a slice per use case then copies the rule into each slice. |
| **Hexagonal (ports and adapters)** | The core holds the logic and declares a port (an interface) for each external system it needs. An adapter implements the port for one technology (S3, GCS, a local FS, a DB). The core imports no adapter. | One logic runs against two or more back ends, or a back end must be faked in tests: a store over S3 and GCS, a clock, an external API. | The port is an interface owned by the core, named for the need (`ObjectFS`), not for the technology. One adapter type per technology. A contract test runs every adapter. The constructor takes the port. | One back end and no fake: the port then has one implementation and only adds a layer. |
| **DDD split (bounded contexts)** | The domain splits into contexts, each with its own language, its own types, and its own store. A term means one thing inside a context. Contexts talk through a published contract, translated at the edge. | The same word means different things to different parts of the system, or two teams or processes own different rules: an instance record in the bucket and in the DB, a snapshot for the housekeeper and for the restore tool. | An aggregate per consistency rule, changed only through its root. A value object for each typed value (`SnapID`). A domain event or a record at the context edge. A translation at the edge, not a shared struct (`good-design-dry`: keep one type per entity). | One language and one team: the split then adds translation code with no second meaning to protect. |

Decide in this order:

1. Does a term mean two things, or do two owners hold different rules? Split into bounded contexts first.
2. Inside a context, does the logic run against an external system that changes or needs a fake? Put a port there.
3. Inside the rest, are the use cases independent? Make one slice per use case.
