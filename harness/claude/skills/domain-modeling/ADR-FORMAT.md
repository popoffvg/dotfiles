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

**Every ADR lists at least one Property under `## Properties`. A Property is a theorem over the system's observable behavior.** This definition applies to both ADR kinds. The ADR stores its plain-language statement; the drafting worksheet makes its meaning precise. A reviewer cites it as `ADR-NNNN/P2` and checks whether a change preserves it.

Model the system at its boundary: calls, results, stored data, outbound requests, time, and resource use. Internal components and implementation steps belong in the decision, consequences, spec, or patterns file. A public format or error result can appear when it is itself the promised behavior.

### Property gate

Run this gate before adding or changing a Property. Use one worksheet row per candidate, outside the ADR:

| Candidate | Observables | Assumptions | Lean theorem statement | Counterexample | Verdict |
|---|---|---|---|---|---|
| Successful reads return successfully written bytes, absent intervening changes. | Write result and subsequent read. | No intervening write or delete; read succeeds. | `∀ b, writeOK b → noInterveningChange → readOK → readBytes = b` | A successful read returns different bytes. | Pass |

1. **Define the model.** Name the observable inputs, outputs, and traces needed to express the claim. Define each theorem symbol in these terms.
2. **State the assumptions.** Include concurrency, failure, and timing conditions that affect the guarantee. Take them from the approved contract. An assumption that merely restates the conclusion makes the check circular.
3. **Write the theorem statement.** Use Lean notation with explicit quantifiers, hypotheses, and a conclusion over the model. A theorem signature checks precision; it does not prove the implementation correct. Record unconfirmed assumptions as open questions.
4. **Give a counterexample.** Describe an observable execution that satisfies the assumptions and violates the conclusion. If the model cannot express it, revise the model or the claim.
5. **Check independence from the option.** Keep a guarantee that another implementation of the same contract must preserve. Move a chosen mechanism into the decision or consequences.

**Completion criterion:** every retained candidate has defined symbols, approved assumptions, a precise theorem statement, and an observable counterexample. Its plain sentence preserves the theorem's scope and conditions. A candidate that needs internal structure moves out of Properties. A vague candidate returns for clarification.

The worksheet records theorem statements, not Lean proofs. Compile and prove a separate model only when the task requests formal verification.

| Candidate | Gate result |
|---|---|
| A successful read returns the last successfully written bytes, absent intervening changes. | Pass: compare observable writes and reads. |
| A dry-run leaves resources and stored state unchanged. | Pass: compare observable state before and after the run. |
| A huge file uploads in parallel parts. | Move: this chooses an implementation mechanism. State the approved time or resource guarantee instead. |
| Uploads are fast. | Clarify: the workload, conditions, and bound are missing. |
| The storage client calls a particular helper. | Move: the claim needs internal code structure. |

### Property table

**Mark each Property `[keep]` or `[new]`.** `[keep]` is a guarantee that today's code already gives and the decision keeps. `[new]` is a guarantee the decision adds. List the `[keep]` ones first, so a reader sees what must not break before what changes. A Property carries no source and no evidence words: no file, no line number, no fact name, no link, no "today on X", no "closes Y". The evidence goes in the decision paragraph or in the research it cites. A guarantee of today's code that the decision drops goes under `## Considered Options` or `## Consequences` with the reason.

**Write the Properties as one table: `Id`, `Property`, `If broken`, `Recovers by`.** One row per Property, so a reader scans the guarantees and their cost in one look. The `Property` cell is one short sentence, aiming for about 15 words while preserving the theorem’s conditions, with its `[keep]` or `[new]` mark first. Fill `If broken` from steps 2 to 4 of the [`and-what`](../and-what/SKILL.md) skill on the advice "keep this Property": what a caller, a user, or an operator sees when it breaks, in one short clause. `Recovers by` is `retry`, `restart`, `a human`, or `itself`. Both cells obey the black-box rule. A Property whose break nobody sees guarantees nothing: drop it. `wm-constraints.py` reads only the `Id` and `Property` cells as the rule. A `|` inside a cell is written `\|`.

```md
| Id | Property | If broken | Recovers by |
|---|---|---|---|
| P1 | [keep] Successful reads return the last written bytes, absent intervening changes. | The caller receives corrupted data. | a human |
| P2 | [new] A dry-run leaves resources and stored state unchanged. | A preview changes the target. | a human |
```

**Never renumber or reuse a Property number.** Code, TODOs, and reviews cite `ADR-NNNN/Pn`. A reversed Property leaves the table: delete its row, write its number and the reason in the changelog line, and keep the gap. A new Property takes the next number after the highest one the ADR ever used.

**Keep implementation details in the spec, TODO, or patterns file.** A private helper, an error value, a function name, a call order, or a retry loop is how the code keeps a Property, not a decision. Write it in the spec, the TODO, or the patterns file. When ADRs merge, an absorbed ADR brings its Properties, its Reason and provenance, and its options; its context becomes at most one sentence of the decision paragraph, never a paragraph of its own.

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
