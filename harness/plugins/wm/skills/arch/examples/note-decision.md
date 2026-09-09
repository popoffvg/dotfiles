---
type: decision
id: "003"
status: approved            # approved | declined
description: >              # 1–3 sentences — the text the index shows, and the rule wm-constraints.py prints verbatim — ref-note-format.md § Frontmatter
  Two refreshes racing on the same expired token: the second one returns 409 and the caller
  retries with the new token. Redis single-flight locking was rejected — 40 lines for under
  0.01% of traffic.
date: 2026-06-18T14:45:10
source: human               # human | auto — auto = nobody was asked, nobody chose it
tags: [auth, concurrency]
links:
  - "[[002-fact-token-ttl]]"
---

> The frontmatter is what the thought index and `wm-constraints.py` read; the per-key contract is
> `arch:ref-note-format.md` § Frontmatter. Specific to a decision: `status: approved` unless the
> user rejected the choice or a later note superseded it, both of which make it `declined`.
> `description` is the rule text `wm-constraints.py` prints verbatim into the constraint set, so
> write it as a rule code can obey. `source: human` when a person chose, `source: auto` when nobody
> was asked — and an `auto` decision names what forced it in `## Why`.

# Reject concurrent refreshes (single-flight)

> Copy to `<notes-dir>/thoughts/NNN-decision-<slug>.md`, and delete the `>` lines.
> Write a decision note when the answer IS a choice — the user decided, recommended, or picked
> between alternatives. When the answer is an observed truth, write a fact note instead.
> The prose follows `harness-dev:text-style`.

> The title names the thought as a statement — imperative or declarative — in at most 60
> characters. The frontmatter `description` never paraphrases it: the title names the thought, the
> description says what it settled (`arch:ref-note-format.md` § Frontmatter).

## Question

What happens when two refreshes race on the same expired token?

> The exact grilling question, one sentence, ending in `?`. A topic is not a question.

## Resolution

Accepted the recommendation: the second refresh returns 409.

> One sentence. When the user chose against the recommendation, say so: "User chose X because Y".

## Why

| Option | Description | Verdict |
|--------|-------------|---------|
| A — allow both | Both produce valid token pairs from one old token | Rejected: leaks access, breaks the rotation invariant |
| B — reject second | Return 409, caller retries with the new token | Chosen: safe, simple, rare in practice |
| C — idempotent queue | Deduplicate via Redis locking, return the same pair | Rejected: ~40 lines of locking for a case under 0.01% of traffic |

The 15-minute TTL in [[002-fact-token-ttl]] makes the race rare, so option C's complexity is not paid for.

> **Why** is the core of the note — a decision without it is unresolved, not recorded.
> Chosen from alternatives → one row per alternative with the reason it lost.
> Forced by constraints → list the constraints and show how they leave one option.
> Auto-discovered (`source: auto`) → name the `path:line` (or the research doc) that forced the choice and say what
> the code does there. Nobody was asked, so the code IS the reason; the reviewer reads these first.

## Depends on

- [[002-fact-token-ttl]] — the 15-minute TTL makes the race window small, so locking is overkill

> One line per prerequisite note, each saying HOW it constrains this decision. A bare "see also"
> link is not a dependency. Omit the whole section when nothing constrains the choice.
