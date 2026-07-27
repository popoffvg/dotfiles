---
name: pedant
description: >
  Attack every name in the code — variables, types, functions, methods, parameters, fields, constants —
  and reject any that reads unclearly without surrounding context or leans on technical/implementation
  terms instead of domain (DDD ubiquitous) language. Use during code review, before approving a diff, or
  when the user says "pedant", "review the naming", "check the names", "are these names clear". Surfaces
  names that hide a bug or let a reviewer approve one.
---

# Pedant — naming review

Attack every identifier. A name survives only if it passes both gates; otherwise propose a rename.

**Gate 1 — clear without context.** A reader who sees the name alone, with no surrounding code, knows what it holds or does. Includes unit and boundary where they matter (`timeoutMs`, not `timeout`).

**Gate 2 — domain language.** The name is a term from the problem domain (ubiquitous language), not an implementation or technical term. `placeOrder`, not `insertOrderRow`. One term per concept across the whole diff — no synonyms.

## Action flow

1. Collect every declared name in the diff: variables, parameters, fields, constants, functions, methods, types.
2. Run each name through the smell table below. Record the first smell it hits.
3. For each failing name, state: `name — smell — the bug it can hide — → rename`.
4. Verify renames against the rest of the diff: the same concept must get the same word everywhere; two concepts must not share a word.
5. Report the failures ranked by review risk (a lying name first, cosmetic vagueness last). Names that pass both gates: don't list them.

## Smell table

| Smell | Example | Bug it hides in review | Fix |
|---|---|---|---|
| **Lying name** — name claims one behavior, code does another | `getUser` mutates; `isValid` returns a count; `deleteX` soft-deletes | Reviewer trusts the name, skips the body, approves the wrong behavior | Name what it does: `loadAndTouchUser`, `validationErrorCount`, `markXDeleted` |
| **Technical term** — implementation word for a domain concept | `data`, `obj`, `row`, `record`, `dto`, `insertOrderRow` | Domain rule invisible; reviewer can't tell if the invariant is enforced | Domain term: `order`, `placeOrder` |
| **Missing unit / currency** | `timeout`, `size`, `delay`, `amount`, `distance` | Wrong unit passes review (ms vs s, cents vs dollars, bytes vs KB) | Encode it: `timeoutMs`, `sizeBytes`, `amountCents` |
| **Boundary unclear** — inclusive/exclusive, index/count | `first`/`last`, `count` used as index, `end` | Off-by-one approved because the boundary was never stated | `startIndex`/`endExclusive`, `itemCount` vs `lastIndex` |
| **Non-predicate boolean** | `status`, `flag`, `active` (as bool) | Reviewer misreads a bool as an enum/value | Predicate: `isActive`, `hasErrors`, `canRetry` |
| **Negated / double-negative** | `notReady`, `disableCache=false`, `ignoreMissing` | `!notReady` and `disableCache=false` are misread under review | State positively: `isReady`, `cacheEnabled` |
| **Synonym drift** — one concept, many words | `user` / `account` / `member` in one diff | Reviewer thinks they're different things; misses that they alias | Pick one domain term, use it everywhere |
| **Homonym** — one word, two concepts | `key` for map key and crypto key | Reviewer conflates two things; a mix-up ships | Distinct terms: `cacheKey`, `signingKey` |
| **Vague qualifier** | `data2`, `tmp`, `newList`, `info`, `helper`, `util`, `manager`, `process`, `handle` | Says nothing; reviewer can't judge correctness | Name the role: `pendingOrders`, `retryPolicy` |
| **Abbreviation needing context** | `cfg`, `usr`, `acc`, `q`, `res`, `val`, `e` (non-loop) | Expands wrong under review (`acc` = account? accumulator?) | Spell it: `config`, `user`, `queue`, `response` |
| **Type-encoded noise** (Hungarian) | `strName`, `iCount`, `arrItems` | Type in name drifts from real type; reviewer trusts the prefix | Drop it: `name`, `count`, `items` |
| **Collection number mismatch** | singular `user` holding a list; plural `orders` holding one | Reviewer misreads cardinality; a loop/scalar bug slips | Match cardinality: `users`, `order` |
| **Command/event tense** (CODE_STYLE) | event named `CancelOrder`; command named `OrderCancelled` | Reviewer expects the wrong direction (intent vs fact) | Command imperative (`CancelOrder`); event past-tense (`OrderCancelled`) |

## Hard rules

- Judge the name against its **actual body**, not its declared type or a comment. A comment that explains a name is evidence the name failed Gate 1 — rename, don't comment.
- Every rename must be a real domain term. If you can't name the concept, the code is missing a concept — say so; don't invent a technical placeholder.
- Loop counters (`i`, `j`) and the standard idiom of the language (e.g. `err`, `ctx`, `ok` in Go) pass — they read clearly in their idiom. Don't flag idioms.
- Don't rename in this pass. Report `→ rename` proposals; let the user or the implementer apply them.
- Report only failures. A clean diff gets one line: "names pass both gates."
