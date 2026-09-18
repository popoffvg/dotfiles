
# Rules

- Use simple, direct english language that is easy to understand and follow with B1 wording.
- Use ASD-STE100 standard for any writing and communication.
- Do not use a metaphor or figure of speech where a literal phrase would convey the same idea.
<when="writing code">
- Short sentences. RFC 2119 keywords for obligations. Commit = imperative subject; body only for a fact the diff cannot show. Comments only where code needs clarification — never narration.
- Every name, string, and comment is read by a plain-text search, and read once. Put each fact where that search lands, in the shortest form that still forces the behavior.
</when>
<when="naming anything — a type, a function, a field, a file, a module, a test, a metric, an event, an error message">
- Load the `searchable-names` skill (`wm` plugin). It owns every rule about the name itself: one term per concept, the 2–4 word public name, one concept per file, the domain concept in a type, and the whole string literal.
</when>
<when="the code holds a set of similar items plus a loop or switch that reads them — columns, fields, routes, menu entries, flags, steps">
- **Split the declarative table from the imperative reader, and keep every per-item fact in a row.** A row carries the name, the type, the order, the membership, and the per-item exception. The reader turns a row into output and holds no per-item knowledge.
- **The table-diff test.** Change what ships and count the files edited. If changing *what* ships means editing the reader too, the fact belongs in a row.
- **The identity-branch test.** A branch keyed on one item's identity (`if id == "status"`) is a field missing from that row. Add the field; delete the branch.
- A second array of ids that fixes order or membership is the common breach: two lists can disagree, one cannot. Sequencing, error handling, retries, and I/O stay in the reader.
- **Order the fields of a row by what identifies it** — the key first, then the type, then the qualifiers. Take the order from the domain.
</when>
<when="writing or keeping a comment or a doc tag">
- **NEVER** add links to the task or docs in the code — no URL, no ticket id, no spec slug, no note filename. Write the reason itself. A comment reveals the unclear invariant and the assumption about an external system that the code does not contain.
- Never name a version, a plan, or a planned increment — write the fact as it stands today.
- Never restate platform or domain behaviour the reader already knows — keep only what is true of this repo and nowhere else.
- **Gloss a domain term once, where the file first uses it, then use it bare.**
- **Sixty words cap any doc: a module docstring, a symbol's doc, a comment block.** Move a constraint down to the symbol it constrains, where the search lands. Cut the rest, or make it a type or a name.
- Before you commit, read this block against the diff.
</when>
<when="a conclusion is about to rest on nothing-found — no process in `ps`, no grep hit, an empty query, a subagent's 'no precedent here'">
- **A negative finding needs a positive control.** Run the same query against a
  neighbour you know exists. A query that cannot see anything answers exactly
  like a query about something that is gone.
</when>

## DO NOT DO

- Don't add your Co-Author to the commit messages
- Don't add references to the specification to implementation
- Don't write comments for code if user does not ask it directly. The code should be self-explanatory
- Don't add line break inside one paragraph to the md files or to the user response

## Tools

- fff for all file search/grep: `mcp__fff__grep` / `mcp__fff__find_files` / `mcp__fff__multi_grep` over built-in Grep/Glob — faster, frecency-ranked.
- perl for multi-editing files, not bash.

## Long commands

**Run every test, build, lint, install, or dev-server command in the background** (`Bash` with
`run_in_background: true`), never in the foreground. A foreground run hides its output until it
exits; a background run streams into a task the user can open and watch. Read the `bg-build-and-test`
skill for what stays in the foreground and how to wait for the exit.

## Scripts

→ Write reusable scripts to `~/.claude/scripts/<name>.sh` (create dir if missing).
→ Write md file for each script in `~/.claude/scripts/` with metadata only. Description in metadata should be a one-sentence summary of what the script does.
→ Before writing a new script, check existing scripts in `~/.claude/scripts/` for overlap using MANIFEST.md and script metadata.
→ Idempotent, accept args where useful, `chmod +x` on creation.

---

@OPEN-FILE.md
@RTK.md
