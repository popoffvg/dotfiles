# CODE_STYLE

Every name, string, and comment is read by a plain-text search, and read once. Put each fact where that search lands, in the shortest form that still forces the behavior.

<when="naming anything — a type, a function, a field, a file, a module, a test, a metric, an event, an error message">
Load the `searchable-names` skill (`wm` plugin). It owns every rule about the name itself: one term per concept, the 2–4 word public name, one concept per file, the domain concept in a type, and the whole string literal. This file keeps only the comment prose those names carry.
</when>

<when="the code holds a set of similar items plus a loop or switch that reads them — columns, fields, routes, menu entries, flags, steps">
## Declarative table vs imperative reader

Split the two, and keep every per-item fact on the declarative side.

- **Declarative** — the facts about each item: its name, its type, its order, its membership in a subset, its per-item exceptions. One table, one row per item, each row complete.
- **Imperative** — the reader that turns a row into output. One path, no per-item knowledge. It merges no defaults, injects no fields, and consults no second list.

**The table-diff test.** Change what ships and count the files edited. If changing *what* ships means editing the reader too, the fact belongs in a row.

**The identity-branch test.** A branch in the reader keyed on one item's identity (`if id == "status"`) is a field missing from that row. Add the field; delete the branch.

A second array of ids that fixes order or membership is the common breach: two lists can disagree, one cannot. Where list position genuinely cannot carry the meaning — a subset shipping in its own order — give the row an explicit field and assert on duplicates and gaps. See the `deliver-the-named-shape` skill.

Imperative stays imperative: sequencing, error handling, retries, and I/O are code, not table rows.

**Order the fields of a row by what identifies it.** The identifying field — `name`, the key, the id — goes first, then its type, then its qualifiers and metadata. Take the order from the domain, never from a neighbouring file that happens to lead with a type.
</when>

<when="writing or keeping a comment or a doc tag">
# DO NOT DO

- **NEVER** add links to the task or docs in the code — no URL, no ticket id, no spec slug, no `NNN-decision-*` note filename. The reader cannot open any of them. Write the reason itself. A comment reveals the unclear invariants and the assumptions about external systems that the code does not contain.
- Never name a version, a plan, or a planned increment in a comment or column/field description — write the fact as it stands today.
- Never restate platform or domain behaviour the reader of this codebase already knows — keep only what is true of this repo and nowhere else.
- Don't add the comment that explains how the code works — the reader already knows how to read code.

**Follow ASD-STE100 for what the rules here do not name.**

**Gloss a domain term once, where the file first uses it, then use it bare.** A real domain term stays, because renaming it would break the shared language. A term the reader must look up costs more than the sentence saves.

**Sixty words cap any doc: a module docstring, a symbol's doc, a comment block.** A module docstring past the cap holds constraints that belong to the functions below it. Move each one down to the symbol it constrains, where the search lands. A symbol's doc past the cap keeps the invariant a caller can violate and the assumption about another system. Cut the rest, or make it a type or a name.

Before you commit, read this section against the diff.
</when>
