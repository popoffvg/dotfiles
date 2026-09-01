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

## The comment deletion test

Run this test on each sentence, not on the comment as a whole. Delete the sentence, read the code under it, and name the fact you lost.

- No fact lost — the comment paraphrased the code. Delete it.
- A fact lost — keep that fact alone: an invariant, an assumption about another system, a unit or scale, a nullability rule, or an alternative that was rejected and why. Never what the code shows.
- Half a fact lost — keep the reason clause, drop the clause that narrates the code.

A doc tag stating only a parameter's name and its type restates the signature. Write the constraint on the value, or no tag.

## Package the fact

**Put the subject in the first five words.** A late subject leaves the reader holding a clause with nothing to attach it to.

**Keep a backward reference beside its meaning.** `both`, `either`, `that`, `the same` and `it` must never reach across a dash, a parenthesis, a line break or a sentence to find it. Where the meaning sits in an earlier sentence, name it again.

**Close each thought before opening the next.** No deferred clause: `X, which is what lets Y treat Z as W`.

**One fact per sentence, twenty-five words at most.** Two facts joined by `and` or `so` are two sentences.

**Say what happens.** The rejected alternative gets its own sentence, or gets cut. An interjected one (`Drop it here — rather than emit a hole — to keep the indexes aligned`) holds the fact open. Negation first (`not from a clean scan`) makes the reader carry a falsehood before reaching the fact.

**One em-dash per comment, and none in a sentence that already carries a parenthesis.**

**Name no count, no threshold, and no membership the code already declares.** Not `the four skip reasons`, not `the bottom third`, not a parenthetical re-listing the enum below. A number in prose is a second definition site, checked by no compiler and covered by no test, and it goes stale the first time the table gains a row. Name the table and let the reader count. Where a comment genuinely must enumerate, give each item its own line.

**Lead with the constraint, not the context.** The first sentence carries what a caller can violate.

**Write for a reader at B1 English.** Take the common word, and give each word one meaning. Never make a reader look up a word that a shorter word replaces: `lower` not `penalize`, `guess` not `proxy`, `use` not `leverage`, `change the order` not `reorder`, `each` not `respective`, `start` not `initiate`. A domain term is the one exception, under the gloss rule below.

**Write the active voice and the present tense.** `The caller must close the file`, not `The file is expected to be closed`. Turn a noun back into its verb: `after it validates the config`, not `after validation of the config`.

**Follow ASD-STE100 for what the rules here do not name.**

**Gloss a domain term once, where the file first uses it, then use it bare.** A real domain term stays, because renaming it would break the shared language. A term the reader must look up costs more than the sentence saves.

**Sixty words cap any doc: a module docstring, a symbol's doc, a comment block.** A module docstring past the cap holds constraints that belong to the functions below it. Move each one down to the symbol it constrains, where the search lands. A symbol's doc past the cap keeps the invariant a caller can violate and the assumption about another system. Cut the rest, or make it a type or a name.

Before you commit, read this section against the diff.
</when>
