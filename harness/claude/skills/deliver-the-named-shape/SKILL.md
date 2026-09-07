---
name: deliver-the-named-shape
description: Use when the ask names a concrete artifact shape — "a constants module", "a list of names", "one registry", "an enum", "a glossary", "a lookup table", "make it declarative", "a config table", "just the strings", "shared constants for X and Y" — and the obvious design instinct is to enrich it (wrap entries in objects, add aliases, precompute matchers, nest groups, derive views) or to leave part of the content in the code that reads it (injected fields, merged defaults, parallel index lists). Build the named shape and put every per-item fact in the item; offer enrichment as a question instead of shipping it. Also fires when a proposal is rejected as "too much machinery" and needs redrawing.
metadata:
  origin: self-improvement
---

# Deliver the shape that was named

When an ask names an artifact shape, build that shape. Nothing more.

## The rule

A named shape is a specification, not a starting point. "A list of strings" means a list of strings —
not a list of objects that each hold a string.

Ship the flat thing. Where a richer mechanism seems necessary, name the need in one sentence and let
the person decide:

> Legacy spellings need somewhere to live. One extra field per old name, or out of the module entirely?

That costs one line. Shipping the mechanism inside the proposal costs a design round to build and a
second one to strip, and any decision taken on top of it has to be withdrawn.

## What counts as enrichment — the forms to resist

Each of these turns a named flat shape into a mechanism:

- **Wrapping the entry** — a value object per item (`{canonical, aliases, pattern}`) where a string
  was asked for.
- **Precomputing** — matchers, regexes, indexes, reverse maps that the consumer did not request.
- **Nesting** — subgroups, namespaces, or per-category modules where the ask implies one flat level.
- **Projections** — a second export derived from the first (`Foo` and `FooMatchers`, `X` and `XById`).
- **Metadata fields** — a tag on each entry that some future consumer might branch on.
- **Splitting by use** — one registry per position or per caller, where the ask named one registry.

## When the named shape is a declaration table

"Make it declarative" names a shape too, and it is a claim about **where the content lives**: a
reader of one row must see everything that row produces. The builder is then a dumb map — it
contributes nothing.

Three ways content leaks back into code, each of which leaves the truth in two places:

- **An injected field** — the transform adds a key to every item ("the producer id", "the default
  unit", a timestamp). If the value is unknown at authoring time, make it a **parameter of the
  table** (`items(runId)`), not something the transform bolts on. Repeating the key on every row is
  the cost, and it is the point.
- **A merged default** — the builder fills in what a row omitted. Now a row's meaning depends on
  code somewhere else, and a reader cannot tell an omission from a choice.
- **A parallel index list** — a second array of ids that fixes order or membership. Order and
  membership are properties of items, so they belong in the table: order by list position, and
  membership as a field on the row. Two lists can disagree; one cannot.

Where a property genuinely cannot be read off list position — a subset with its own ordering, say a
contract that includes four of nine items in a different order — give the row an explicit field
(`csvOrder: 3`) and assert on duplicates and gaps. That is still declarative; a second list is not.

The tell: the table-diff test in `CODE_STYLE.md` fails — the shape was not delivered.

## The tell that it is happening

The ask uses vocabulary words: *list*, *constants*, *names*, *strings*, *fields*, *one module*. The
answer being drafted uses mechanism words: *resolver*, *matcher*, *view*, *strategy*, *value object*,
*generic*.

That mismatch means a naming problem is being answered as a runtime-API problem. A vocabulary lives
in whoever reads it; a mechanism has to be maintained.

## Why the instinct misfires

An enriched artifact looks strictly better in isolation — it anticipates needs, so it seems generous.
It is not, for two reasons:

- Every added field is a maintenance surface, and the person asking is the one who maintains it.
- Enrichment silently claims decisions. A precomputed alias list decides *that* aliases exist, *where*
  they live, and *how* they are matched — three rulings nobody made.

## After being told it is too much

Redraw at the named shape, then state plainly what the simplification withdrew — including any earlier
decision that assumed the machinery. A decision resting on a withdrawn mechanism is stale the moment
the mechanism goes, and silently keeping it produces a spec that contradicts its own artifact.
