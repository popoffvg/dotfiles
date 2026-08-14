# code bricks — the component roster

The closed set of component types. A **component** is a type that owns one responsibility; a
**brick** is the type of that responsibility.

A component that fits no brick owns more than one responsibility — split it before writing the
code. A component that fits two bricks is the same fault.

Naming and home — which module a piece lives in, what it may import, what it may not be called —
are owned by `CODE_STYLE.md` § Domain module layout. This skill adds the two things that file does
not carry: the **metric** and the **common structure**.

## Roster

| Brick | Owns |
|-------|------|
| **command** | One action on one subject — a mutation or a query — plus the events the action produces. |
| **service** | The union of the commands over one subject. Holds no logic. |
| **flow** | The conditional sequence of commands, read top to bottom. |
| **gateway** *(driver, repository)* | One external system: its call, its failure modes, and the type conversion both ways. |
| **server / consumer** | The inbound edge. Decodes an external request or event, starts one command or flow, encodes the result. |
| **policy** | One decision, returned as a value. |
| **scheduler** | The inbound edge driven by time. Nothing calls it. |
| **wiring** | Builds every brick and starts the edges. The composition root. |

Pick the brick by this column alone. The metric of each is in its section below; it is the check
applied *after* the brick is known, not the way to choose one.

## The metric

**A metric is one number counted in the finished brick, not an estimate made before it.** Each brick
below states what to count, over what scope, what does not count, and the bound. The count answers
one question: does this component still own one responsibility?

**A brick over its bound is not a long brick — it is two bricks in one unit.** The fix is always the
split its section names. Raising the bound is never the fix, because the bound is not a style
preference: it is the size at which the second responsibility becomes visible.

## Common structure

**Every brick is one unit with one entry point.** "Unit" is whatever the language groups code with
— class, module, package, namespace, crate, or a single file. The entry point is the one symbol a
caller uses; everything else in the unit is reachable only through it. The rule holds in every
language; only the keyword changes.

**The brick fixes what the entry point returns.** A command, a flow, and a policy return their
result. A service and a gateway return their interface. A server and a consumer return their routes
or subscriptions. A scheduler returns its schedule. Wiring returns the running process.

**The sketches below are TS pseudocode — read them for the ordered parts, not the syntax.** The
notation is the one the `flow-scetch` skill owns, where the unit is a `namespace` and the entry
point is `flow(...)`. The order of the parts survives translation into any language; the keywords do
not. None of them is a template to copy.

### command

**Metric — subjects written: 1.** Count the distinct subjects the command changes and persists in
one execution. A subject is one aggregate or one record, not one table and not one call. Reads do
not count: a command may load any number of subjects and still write one.

**Second metric — branches: ≤ 2.** Count only the branches that pick between results. A guard that
rejects invalid input or a missing subject and returns immediately is not a branch — it is the
precondition of the one path. Three real branches mean the command is deciding, and the decision is
a policy or a flow.

Two subjects → two commands, joined by a flow. Three branches → lift the decision into a policy the
command calls, or into the flow above it.

Parts in order: input type, result union, load, decide, write, emit.

```ts
namespace CancelOrder {
  type Input = { orderId: OrderId; reason: CancelReason }
  type Result = Cancelled | NotFound | AlreadyShipped

  function flow(input: Input, orders: OrderGateway): Result {
    const order = orders.byId(input.orderId)      // load through one gateway
    if (!order) return NotFound                   // guard
    const event = order.cancel(input.reason)      // the subject decides
    if (event === AlreadyShipped) return event
    orders.put(order)                             // the one write
    return Cancelled(event)                       // the event leaves with the result
  }
}
```

### service

**Metric — commands: ≤ 7.** Count the methods on the interface. Each one is a command over the same
subject. Past seven, the subject has almost always split into two subjects that share a name.

**Second metric — statements per method: 1.** Count the statements in a method body. The one
statement is the delegation to its command. A second statement — a validation, a mapping, a log with
a decision in it — is a command hiding inside the service.

**Third metric — held state: 0.** Count the fields that are not bricks the service delegates to. A
service holds its gateways and its clock; it holds no counter, no cache, no accumulated value.

Eight commands → split the service by subject. A second statement → move it into the command it
belongs to. A non-brick field → the state belongs to a subject, which a gateway loads and stores.

Parts in order: the interface, one method per command; the constructor, one delegation per method.

```ts
namespace Orders {
  interface Service {
    place(input: PlaceOrder.Input): PlaceOrder.Result
    cancel(input: CancelOrder.Input): CancelOrder.Result
    ofCustomer(input: OrdersOfCustomer.Input): OrdersOfCustomer.Result
  }

  function flow(orders: OrderGateway): Service {
    return {
      place: (input) => PlaceOrder.flow(input, orders),
      cancel: (input) => CancelOrder.flow(input, orders),
      ofCustomer: (input) => OrdersOfCustomer.flow(input, orders),
    }
  }
}
```

### flow

**Metric — steps: ≤ 9.** Count the calls to a command. A guard and its compensation belong to the
step they protect and are not steps of their own. Nine is the point past which a reader stops
holding the sequence in mind and starts scrolling back.

**Second metric — nesting depth: ≤ 2.** Count how deep the conditionals and loops nest inside the
entry point. Depth 1 is a guard on a step. Depth 2 is a branch that runs a different sequence.
Depth 3 means a decision is being computed inside the flow instead of being asked for.

**Third metric — own I/O calls: 0.** Count the calls the flow makes to a client, a database, or a
network directly, past its commands. The flow orders work; it performs none.

Ten steps → a second flow is inside; name it and call it as one step. Depth 3 → lift the inner
condition into a policy the flow calls. Any direct I/O → wrap it in a gateway and a command.

Parts in order: the `// trace:` line, then one named step per line. Each step calls one command.
The guard and the compensation stay beside the step that needs them.

```ts
namespace Checkout {
  // trace: reserve the stock, charge the card, place the order; release the stock if the charge fails.
  function flow(cart: Cart): Placed | OutOfStock | PaymentDeclined {
    const reservation = Stock.reserve(cart)
    if (!reservation) return OutOfStock

    const payment = Payments.charge(cart.total)
    if (!payment) { Stock.release(reservation); return PaymentDeclined }

    return Orders.place(cart, payment)
  }
}
```

### gateway (driver, repository)

**Metric — external systems: 1.** Count the systems the unit reaches. One system is one address,
one credential, and one protocol. Two databases behind one connection string are one system; a
database and a queue are two, even when one library speaks to both.

**Second metric — domain types on the wire: 0.** Count the domain types that appear in a payload,
a row, a query string, or a serializer call. The conversion pair is the only place the domain types
and the system's types meet; past it, only the system's types travel.

**Third metric — remote operations per method: 1.** Count the calls to the external system inside
one method. A method that makes two is a small flow, and it will need a transaction the gateway
cannot promise.

A second system → a second gateway, joined by a flow. A domain type on the wire → the conversion is
missing; add it to the pair. Two remote calls in one method → split the methods and order them in a
command.

Parts in order: the interface in domain words, the constructor taking the client, one method per
remote operation, the conversion pair. The retry and timeout rules of that system live here and
nowhere else.

```ts
namespace OrderGateway {
  interface OrderGateway {
    byId(id: OrderId): Order | null
    put(order: Order): void
  }

  function flow(sql: SqlClient): OrderGateway {
    return {
      byId: (id) => { const row = sql.query(SELECT_ORDER, id); return row ? toOrder(row) : null },
      put: (order) => sql.exec(UPSERT_ORDER, toRow(order)),   // retries: 3, backoff 200ms — this system only
    }
  }

  function toOrder(row: OrderRow): Order { /* ... */ }        // conversion, both ways, here
  function toRow(order: Order): OrderRow { /* ... */ }
}
```

### server / consumer

**Metric — commands or flows started per entry: 1.** Count the calls one entry makes into the
application. An entry is one route, one topic, or one handler. Two calls mean the entry is
sequencing work, and a sequence is a flow.

**Second metric — own decisions per entry: 0.** Count the branches that are not decode failures.
Rejecting a malformed request is decoding. Choosing between two commands by looking at a field is a
decision, and it belongs to the flow the entry should have called instead.

**Third metric — domain types in the signature: 0.** Count the domain types in the decode and encode
functions. The edge speaks the wire's types and the command's input type; the domain's own types
never reach it.

Two calls in one entry → name the sequence and make it a flow. A decision → move it into that flow.
A domain type at the edge → the input type is missing; add it.

Parts in order: the constructor taking the service, one entry per route or topic, and inside each
entry: decode → one call → encode.

```ts
namespace OrderHttpServer {
  function flow(orders: Orders.Service): Routes {
    return {
      "POST /orders/:id/cancel": (request) => {
        const input = decodeCancel(request)
        if (!input) return 400
        return present(orders.cancel(input))     // result union → status code; no decision here
      },
    }
  }
}
```

### policy

**Metric — I/O calls: 0.** Count every reach outside the arguments: a client, a database, the
network, the filesystem, the clock, a random source, an environment variable, a global. All of them
count, including the ones a language hides behind a plain-looking call.

**Second metric — results per input set: 1.** Call it twice with the same arguments and count the
distinct results. Two means something ambient leaked in, and the first metric missed it.

Any I/O → the caller must be a command. Read the value there and pass it in as an argument; the
policy then decides on a value it was given, which is what makes it testable without a fixture.

One pure function. No client, no clock, no reader in the signature.

```ts
namespace ShippingCost {
  function flow(order: Order, zone: Zone): Money { /* ... */ }
}
```

### scheduler

**Metric — flows per schedule entry: 1.** Count the flows one entry starts. An entry is one period
paired with one thing to run. Two flows on one period are two entries, or one flow that calls both —
never one entry that runs a list.

**Second metric — own decisions: 0.** Count the branches in the unit. A period is data in a row, not
a condition. An entry that decides at run time what to start is a flow wearing a schedule.

**Third metric — work done in the entry: 0 statements.** Count the statements between the trigger
and the flow call. The scheduler starts work; it performs none, and it holds no result.

Two flows in one entry → split the entry, or name the sequence and make it one flow. A branch → move
it into the flow the entry starts.

Parts in order: the constructor taking the flows, then the table of entries — period and the one
flow it starts.

```ts
namespace Reaper {
  function flow(clock: Clock): Schedule {
    return [
      { every: minutes(5), run: () => Checkout.expireStale(clock.now()) },
      { every: hours(24),  run: () => Orders.archiveClosed(clock.now()) },
    ]
  }
}
```

### wiring

**Metric — branches: 0 beyond config flags.** Count the conditionals. A branch on a declared config
flag is allowed: it picks which implementation gets built, and it is the reason the flag exists. A
branch on anything else — a request, a record, an environment string read on the spot — is a
decision, and wiring makes none.

**Second metric — domain calls: 0.** Count the calls into a command, a flow, or a policy. Wiring
builds bricks and starts edges. The moment it calls one, it has become the flow it was supposed to
hand over to.

**Third metric — construction order: deepest brick first.** Read the unit top to bottom and count
the places a brick is built before the brick it depends on. Zero, always: clients, then gateways,
then services, then the edges.

A branch on data → the choice belongs to a flow. A domain call → move it into the edge that should
have started it. A brick built out of order → the dependency graph has a cycle; break it in the
domain, not with a lazy reference.

Parts in order: open the clients, build the gateways, build the services, start the edges. This is
the same deepest-first order the `code` skill's TODO layers use.

```ts
namespace Main {
  function flow(config: Config): Process {
    const sql = SqlClient.open(config.dsn)
    const orders = OrderGateway.flow(sql)
    const service = Orders.flow(orders)
    return start(OrderHttpServer.flow(service), config.port)
  }
}
```

## What is not a brick

- **Entity, aggregate, value object, event, state** — data with invariants, not a responsibility
  that runs. Their names and homes are in `CODE_STYLE.md` § Domain module layout. A glossary term is
  one of these **or** a brick, never both.
- **DTO** — data at a boundary. It belongs to the gateway or server that converts it, and never
  crosses into a command, flow, or policy.
- **`utils`, `helpers`, `manager`, `core`, `common`** — a name for code that shares no
  responsibility. Every member belongs to one brick above; move it there.
