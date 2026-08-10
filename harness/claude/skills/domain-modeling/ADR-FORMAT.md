# ADR Format

**An ADR is one markdown file with metadata, a decision paragraph, and a changelog.** Active ADRs live in `docs/adr/`, superseded and deprecated ones in `docs/!archived/adr/`. Both directories are created lazily — the first ADR creates `docs/adr/`, the first supersession creates `docs/!archived/adr/`.

## File name and numbering

**Files are `NNNN-slug.md` with a four-digit sequential number.** Scan **both** `docs/adr/` and `docs/!archived/adr/` for the highest existing number and add one. Archived ADRs keep their number and file name — a number is never reused, so a link written years ago still resolves.

## Metadata

**Every ADR carries YAML frontmatter with three keys.** They are required, including on the first draft.

```yaml
---
status: proposed
created: 2026-08-09
updated: 2026-08-09
---
```

| Key | Holds |
|---|---|
| `status` | `proposed`, `accepted`, `deprecated`, or `superseded-by-NNNN` |
| `created` | ISO date the ADR was first written. Never changes. |
| `updated` | ISO date of the last edit to this file. |

**The changelog is the last section of the file, not frontmatter.** It grows with every edit, so it belongs below the decision a reader came for.

```md
## Changelog

- 2026-08-09 — Drafted.
- 2026-09-01 — Accepted after the load test.
```

**Every edit updates `updated` and appends a changelog line.** A status change is an edit. The changelog is why the metadata exists: it separates "this decision was made in 2024 and still holds" from "this was rewritten twice and nobody says why".

## Template

The copyable file is `ADR-TEMPLATE.md`, next to this document. Its body:

```md
# {Short title of the decision}

{1-3 sentences: what is the context, what did we decide, and why.}
```

A title, a paragraph, and the changelog section are the whole requirement. An ADR can be a single paragraph. The value is in recording *that* a decision was made and *why* — not in filling out sections.

### Optional sections

Include these only when they add value, between the decision and the changelog. Most ADRs need none of them.

- **Considered Options** — when the rejected alternatives are worth remembering.
- **Consequences** — when non-obvious downstream effects need to be called out.

## Lifecycle

**Status moves in one direction: `proposed` → `accepted` → `deprecated` or `superseded-by-NNNN`.**

| Transition | What to do |
|---|---|
| Proposed → accepted | Set `status: accepted`, bump `updated`, add a changelog entry. File stays in `docs/adr/`. |
| Accepted → deprecated | The decision no longer applies and nothing replaced it. Set `status: deprecated`, bump `updated`, add a changelog entry, move the file to `docs/!archived/adr/`. |
| Accepted → superseded | A new ADR replaces it. Write the new ADR first, then set `status: superseded-by-NNNN` on the old one, bump `updated`, add a changelog entry naming the replacement, and move the file to `docs/!archived/adr/`. The new ADR states which ADR it supersedes in its opening paragraph. |

**Move archived files with `git mv`** so the history follows the file.

## When to offer an ADR

All three of these must be true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful.
2. **Surprising without context** — a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons.

If a decision is easy to reverse, skip it — you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing."

### What qualifies

- **Architectural shape.** "We're using a monorepo." "The write model is event-sourced, the read model is projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate via domain events, not synchronous HTTP."
- **Technology choices that carry lock-in.** Database, message bus, auth provider, deployment target. Not every library — just the ones that would take a quarter to swap out.
- **Boundary and scope decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only." The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** "We're using manual SQL instead of an ORM because X." Anything where a reasonable reader would assume the opposite. These stop the next engineer from "fixing" something that was deliberate.
- **Constraints not visible in the code.** "We can't use AWS because of compliance requirements." "Response times must be under 200ms because of the partner API contract."
- **Rejected alternatives when the rejection is non-obvious.** If you considered GraphQL and picked REST for subtle reasons, record it — otherwise someone will suggest GraphQL again in six months.
