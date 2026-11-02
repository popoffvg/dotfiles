# ADR Format

**An ADR is one markdown file with metadata, a decision paragraph, and a changelog.** A file in `docs/adr/` is live and binds the code. A file in `docs/!archived/adr/` is dropped. An open question is never an ADR: it lives in `QUESTIONS.md` ([Open questions](#open-questions)).

**An ADR records a strategic decision, never a tactical one.** A strategic decision shapes the whole system and is hard to reverse: the components and their boundaries, a platform with lock-in, where state lives, a contract a user or a caller depends on. A tactical decision chooses how one part is built: where a package or a file lives, a name, a signature, a library inside one component, a value. Write a tactical decision where it applies — the spec, the TODO, or the patterns file — and never as an ADR.

## File name and numbering

**Files are `NNNN-slug.md` with a four-digit sequential number.** Scan **both** `docs/adr/` and `docs/!archived/adr/` for the highest existing number and add one. Archived ADRs keep their number and file name — a number is never reused, so a link written years ago still resolves.

## Metadata

**Every ADR carries YAML frontmatter with four keys.** They are required.

```yaml
---
status: proposed
kind: architecture
created: 2026-08-09
updated: 2026-08-09
---
```

| Key | Holds |
|---|---|
| `status` | `proposed` — written by the agent on a new ADR; `approved` — set by the operator after reading it. An agent never changes it. |
| `kind` | `architecture` — how the system is built; `feature` — what the user can do and see, such as a dry-run mode. |
| `created` | ISO date the ADR was first written. Never changes. |
| `updated` | ISO date of the last edit to this file. |

**The changelog is the last section of the file, not frontmatter.** It grows with every edit, so it belongs below the decision a reader came for.

```md
## Changelog

- 2026-08-09 — Drafted.
- 2026-09-01 — Reworded P2 after the load test.
```

**Every edit updates `updated` and appends a changelog line.** A move to the archive is an edit. The changelog is why the metadata exists: it separates "this decision was made in 2024 and still holds" from "this was rewritten twice and nobody says why".

## Template

The copyable file is `ADR-TEMPLATE.md`, next to this document. Its body:

```md
# {The properties the decision gives the system — not the option picked}

{1-3 sentences: the context and the decision. The why goes under Reason.}

## Reason

In the context of {the use case or the component}, facing {the concern or the force}, we decided for {the option} and against {the strongest alternatives}, to achieve {the quality the title names}, accepting {the cost or the downside}.

Decided by {the operator | the code, for source: auto}, YYYY-MM-DD: {link to the grill item, the chat date, or the file:line}.

## Properties

| Id | Property | If broken | Recovers by |
|---|---|---|---|
| P1 | [keep] or [new] {a guarantee the system keeps while this decision holds, in one short sentence} | {what a caller, a user, or an operator sees when the system breaks P1} | {retry, restart, a human, or itself} |
```

A title, a paragraph, the reason, the Properties, and the changelog section are the whole requirement. The value is in recording *that* a decision was made, *why*, and *what must stay true* while it holds — not in filling out sections.

### Title

**The title names the properties the decision gives the system, not the option it picked.** "Builds are reproducible and isolated from the host", not "Move the build into containers". One decision can give several properties; each one in the title is backed by at least one Property. The option goes in the paragraph, and the file slug comes from the title.

### Reason

**Write the reason as a Y-statement, for a reader who was not in the session.** The form comes from Zdun et al., "Sustainable Architectural Design Decisions" (IEEE Software, 2013): *In the context of* the use case, *facing* the concern, *we decided for* the option *and against* the alternatives, *to achieve* the quality, *accepting* the downside. A manager reads it without the grill files, and it names the cost that a reversal would save. Write one Y-statement per decision the title names, at most three. The decision paragraph states the context and the option; it does not repeat the why.

**End the section with one provenance line.** `Decided by the operator, <date>: <link>` points to the grill item or the chat that holds the operator's words; quote nothing. It is the proof that the operator, not the agent, made the choice. A `source: auto` ADR writes `Decided by the code` and cites the `file:line` or the research file. A reason the agent inferred and the operator never confirmed is an open question: ask "Why A over B?" in `QUESTIONS.md`, and write the ADR only when the operator answers. A choice the operator made without a reason says so in the Y-statement ("the operator set 60 seconds; no measurement backs it"), never with an invented one.

### Properties

**Every ADR lists at least one Property under `## Properties`.** A Property is one invariant: a guarantee the system keeps in every run while the decision holds, at the level of the title — "a huge file uploads in parallel parts", "every upload is cancellable", "a reader never sees a partial object". It is not a test assertion such as an error value, an import, or a signature: a test checks the Property, and the assertion lives in that test. It is numbered `P1.`, `P2.`, … and cited as `ADR-NNNN/P2`. A reviewer checks a diff against each one, so a Property is checkable: "the Installer never runs `terraform apply` on the operator's machine", not "deployments are robust". A `feature` Property states what the user observes and is checkable with one E2E run: "`deploy --dry-run` changes no resource", not "dry-run is safe".

**Read the system as a black box.** A Property is a guarantee of behavior that a caller, a user, or an operator observes at the boundary: what goes in, what comes out, how long it takes, what it costs. It names no component, client, or code structure inside. It names no mechanism of the storage or the transport either: no part, chunk, bucket key, header, checksum, temp file, or rename. Name a backend only when the guarantee itself differs by the backend the user picks. "A huge file uploads in parallel" and "a cancelled upload stops" pass; "the S3 store calls `s3c`" and "the bytes never pass through the controller" do not.

**The Lean test: a Property must be a theorem over the black box.** Model the system as only what a caller, a user, or an operator sees: the calls, their results, the stored data, the requests the system sends to outside services, the time, and the resources. Try to state the Property as a theorem in Lean over that model. If you can, it is a Property. If the statement needs a component, a protocol step, a format, or an error value from inside, or if the line is too vague to state, rewrite it or drop it. The theorem is a check only; the ADR keeps the plain sentence.

```lean
-- "A stored object holds exactly the bytes the writer sent."
theorem stored_is_sent (s : Store) (n : Name) (b : Bytes) (h : (s.write n b).ok) :
    (s.write n b).store.read n = some b
```

**The option test: a Property is not a consequence of the decision.** Ask of each one: would every design that gives the title properties have to keep it? Yes — it is a Property. No, only the chosen option does it — it is a consequence. A consequence names the chosen mechanism: a method list, a package path, a client, a temp file, a value such as a timeout, or a test. Write it in the decision paragraph or under `## Consequences`, never as a Property and never as an ADR of its own.

**Mark each Property `[keep]` or `[new]`.** `[keep]` is a guarantee that today's code already gives and the decision keeps. `[new]` is a guarantee the decision adds. List the `[keep]` ones first, so a reader sees what must not break before what changes. A Property carries no source and no evidence words: no file, no line number, no fact name, no link, no "today on X", no "closes Y". The evidence goes in the decision paragraph or in the research it cites. A guarantee of today's code that the decision drops goes under `## Considered Options` or `## Consequences` with the reason.

**Write the Properties as one table: `Id`, `Property`, `If broken`, `Recovers by`.** One row per Property, so a reader scans the guarantees and their cost in one look. The `Property` cell is one short sentence, at most about 15 words, with its `[keep]` or `[new]` mark first. Fill `If broken` from steps 2 to 4 of the [`and-what`](../and-what/SKILL.md) skill on the advice "keep this Property": what a caller, a user, or an operator sees when it breaks, in one short clause. `Recovers by` is `retry`, `restart`, `a human`, or `itself`. Both cells obey the black-box rule. A Property whose break nobody sees guarantees nothing: drop it. `wm-constraints.py` reads only the `Id` and `Property` cells as the rule. A `|` inside a cell is written `\|`.

```md
| Id | Property | If broken | Recovers by |
|---|---|---|---|
| P1 | [keep] A huge file uploads in parallel. | A 10 GB upload takes hours, not minutes, and the user waits. | itself |
| P2 | [new] Every upload can be cancelled. | A stuck upload keeps its slot, and new uploads queue. | a human |
```

**Never renumber or reuse a Property number.** Code, TODOs, and reviews cite `ADR-NNNN/Pn`. A reversed Property leaves the table: delete its row, write its number and the reason in the changelog line, and keep the gap. A new Property takes the next number after the highest one the ADR ever used.

**Keep the mechanism out of the ADR.** A private helper, an error value, a function name, a call order, or a retry loop is how the code keeps a Property, not a decision. Write it in the spec, the TODO, or the patterns file. When ADRs merge, an absorbed ADR brings its Properties, its Reason quote, and its options; its context becomes at most one sentence of the decision paragraph, never a paragraph of its own.

### Optional sections

Include these only when they add value, between the decision and the changelog. Most ADRs need none of them.

- **Considered Options** — when the rejected alternatives are worth remembering.
- **Consequences** — when non-obvious downstream effects need to be called out.

## Lifecycle

**An ADR is written once the operator approves it, and it is live until it moves to the archive.** The folder is the only state.

| Change | What to do |
|---|---|
| The operator approves a draft | Write the file into `docs/adr/`. Nothing is written before the approval. |
| The decision no longer applies and nothing replaced it | Bump `updated`, add the changelog line `Deprecated: <reason>`, and move the file to `docs/!archived/adr/`. |
| A new ADR replaces it | Write the new ADR first; its opening paragraph names the ADR it replaces. Then bump `updated` on the old one, add the changelog line `Superseded by [ADR-NNNN](../NNNN-slug.md)`, and move the file to `docs/!archived/adr/`. |

## Open questions

**An open question is one section in `QUESTIONS.md`, next to the ADR folder, never an ADR.** It holds a choice nobody has made, and a choice made without a reason ("Why A over B?").

```md
## gcs-client-location

**Question:** Does `gcsc` move under `util/storage` together with `s3c`?
**Blocks:** The package layout of the storage stores.
**Options:**
- A — `s3c`, `gcsc`, and `mis3` move (recommended: the GCS client sits next to the S3 one).
- B — only `s3c` moves.
```

- The slug says what the question is about.
- When the operator answers a strategic question, write the ADR with the `adr` skill. When the answer is tactical, write it where it applies: the spec, the TODO, or the patterns file. Then delete the section. The history keeps it.
- A question that stops mattering is deleted, with the reason in the commit message.
- A spec is ready when `QUESTIONS.md` has no section.

**Move archived files with `git mv`** so the history follows the file.

## When to offer an ADR

All three of these must be true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful.
2. **Surprising without context** — a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons.

If a decision is easy to reverse, skip it — you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing."

### When to offer a feature ADR

Offer one when the session settles a user-visible contract that a user or a script depends on: a command, a mode such as `--dry-run`, an output schema, a confirmation prompt, an exit code. A help text, a color, or a tuned value is not one.

### What qualifies

- **Architectural shape.** "We're using a monorepo." "The write model is event-sourced, the read model is projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate via domain events, not synchronous HTTP."
- **Technology choices that carry lock-in.** Database, message bus, auth provider, deployment target. Not every library — just the ones that would take a quarter to swap out.
- **Boundary and scope decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only." The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** "We're using manual SQL instead of an ORM because X." Anything where a reasonable reader would assume the opposite. These stop the next engineer from "fixing" something that was deliberate.
- **Constraints not visible in the code.** "We can't use AWS because of compliance requirements." "Response times must be under 200ms because of the partner API contract."
- **Rejected alternatives when the rejection is non-obvious.** If you considered GraphQL and picked REST for subtle reasons, record it — otherwise someone will suggest GraphQL again in six months.
