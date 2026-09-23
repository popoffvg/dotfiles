# Code

<when="writing code">
- Short sentences. RFC 2119 keywords for obligations. Commit = imperative subject; body only for a fact the diff cannot show. The code is self-explanatory; comment only where it cannot be — never narration.
- Every name, string, and comment is read by a plain-text search, and read once. Put each fact where that search lands, in the shortest form that still forces the behavior.
- Forbidden words — MUST NOT appear in a name, a string, a comment, or a commit message: `held`, `adopt`.
- **NEVER** add links to the task or docs in the code — no URL, no ticket id, no spec slug, no note filename. Write the reason itself. A comment reveals the unclear invariant and the assumption about an external system that the code does not contain.
- Never name a version, a plan, or a planned increment — write the fact as it stands today.
- Never restate platform or domain behaviour the reader already knows — keep only what is true of this repo and nowhere else.
- **Gloss a domain term once, where the file first uses it, then use it bare.**
- Load the `searchable-names` skill (`wm` plugin). It owns every rule about the name itself: one term per concept, the 2–4 word public name, one concept per file, the domain concept in a type, and the whole string literal.
- **Split the declarative table from the imperative reader, and keep every per-item fact in a row.** A row carries the name, the type, the order, the membership, and the per-item exception. The reader turns a row into output and holds no per-item knowledge.
- **The table-diff test.** Change what ships and count the files edited. If changing *what* ships means editing the reader too, the fact belongs in a row.
- **The identity-branch test.** A branch keyed on one item's identity (`if id == "status"`) is a field missing from that row. Add the field; delete the branch.
- A second array of ids that fixes order or membership is the common breach: two lists can disagree, one cannot. Sequencing, error handling, retries, and I/O stay in the reader.
- **Order the fields of a row by what identifies it** — the key first, then the type, then the qualifiers. Take the order from the domain.
</when>
