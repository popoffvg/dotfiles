> A filled `$RESEARCH_DIR/<slug>.unknowns.md` — the four-quadrant map the `unknowns` route hands over,
> and the route's only deliverable. Copy the file, replace the content, delete the `>` lines; each one
> states the rules for the piece above it. The walk that produces it is `sub-unknowns.md`.
> **The map is written as the walk goes, not at the end.** Each stage appends its quadrant, so a stage
> that never lands on the map never happened.

# Unknowns map — replace the nearest-hash-match anchor rule

## Known knowns — the settled ground

- A comment stores an anchor: the 1-based `line` plus the first 16 hex characters of the SHA-256 of that line, trailing whitespace stripped. `harness/apps/line-comment/server/src/anchor.rs:8`
- Three call sites re-anchor, and each one snapshots, mutates, sorts, and compares by hand: `did_open`, `did_change`, and `reconcile_all` behind the `list` and `copy` commands. `harness/apps/line-comment/server/src/lib.rs:466`, `:488`, `:432`
- A span hashes its first line only and keeps the number of lines it covered wherever that line turns up. `harness/apps/line-comment/server/src/anchor.rs:139`
- The store is one JSON file per workspace root at `.tmp/line-comment.json`, `version: 1`, keyed by repo-relative path. A version mismatch refuses to load and leaves the file untouched. `harness/apps/line-comment/server/src/store.rs:94`
- Nine tests in `tests/session.rs` pin the current anchoring behaviour end to end, driven through `Session` with no transport. `harness/apps/line-comment/server/tests/session.rs:278`

**Settled unless you say otherwise:** the store stays a single JSON file, and `version` bumps rather
than migrating in place.

> Record cited settled ground and distinguish locked facts from assumptions; the quadrant-walk rules
> are `sub-unknowns.md` § 1.

## Known unknowns — the decision ledger

| # | Question | Decision | Closed by |
|---|---|---|---|
| 1 | What breaks a tie between two lines that are equally far from the stored line? | The earlier line wins, and the rule is written down in a test. | user |
| 2 | Does the anchor keep hashing one line, or the line plus its two neighbours? | One line plus the two neighbours, stored as three hashes; a two-of-three match counts as found. | user |
| 3 | Does `version` bump to 2? | Yes. `Store::load` already refuses an unknown version and leaves the file alone, so a bump costs one constant and loses no data. | territory (`harness/apps/line-comment/server/src/store.rs:94`) |
| 4 | Do the three re-anchoring call sites keep their own snapshot-and-compare code? | **OPEN** — unblocked by deciding question 2, because a three-hash anchor changes what "unchanged" means at every call site. | — |
| 5 | Are existing stored comments re-hashed on first load under version 2? | **OPEN** — unblocked by the user saying whether losing the comments in an old store is acceptable for a personal tool. | — |

> The decision ledger has one row per named question, closed by **user**, **territory**, or **OPEN**;
> the closing rules are `sub-unknowns.md` § 2.
> **Decision** holds the answer as a sentence a reader can act on, never "decided" or "see above". A
> `territory` row cites the `path:line` that answered it in **Closed by**.
> **An OPEN row states what unblocks it** — the person, the decision, or the experiment — in the
> Decision cell, marked `**OPEN**`. An OPEN row with no unblocker is an unfinished row: the walk's
> whole purpose is that nothing is left vague, including what is still unknown.
> Numbering is stable so a later message can cite a row.

## Unknown knowns — what got extracted

The user reacted to three anchor formats over their own store file. Each was rendered against the
same six real comments, so the format was the only variable. What they took from each:

| # | Element | steal / skip |
|---|---|---|
| 1 | Three hashes per anchor — the line plus its two neighbours | steal |
| 2 | A confidence score shown beside each re-anchored comment | skip |
| 3 | `💬?` kept exactly as it is for an orphan | steal |
| 4 | A "re-attach" code action on an orphaned comment | skip |

> **Steal/skip chips** are how the user answers a concrete artifact with near-zero typing, and this
> table is the record of the answer. The form: | # | Element | steal / skip |, one row per element the
> artifact showed, the third cell holding exactly `steal` or `skip`.
> Number the rows, and hand the artifact over with the third column empty, so the user's whole reply
> is `steal 1 3` — the numbers, not sentences. A row the user did not answer stays empty and is asked
> again; it is never filled in on their behalf.
> One element per row, and the element is named in the words the artifact labelled it with, so the row
> and the thing the user looked at are the same thing.

- [x] A comment that moves to the wrong line is worse than a comment that goes orphaned. An orphan is visible; a wrong line is a silent lie.
- [x] `💬?` on the wrong line is the failure to design against, not the extra work of re-attaching an orphan by hand.
- [ ] Comments should survive a file rename.
- [x] The consumer is one person reading their own comments in Zed minutes later, never a team over weeks — so a heavier anchor costs nothing and losing an old store costs little.

**What this reshaped:** question 2 was going to be "one hash or a fuzzy line match"; the answer above
turned it into "one hash or three", because three hashes make a wrong-line move much harder while
keeping the orphan path exactly as it is.

> Record reactions to a concrete artifact, not guesses; the extraction method is
> `sub-unknowns.md` § 3.
> **The form is a resonate checkbox**: one statement per line as `- [ ]`, written in the user's own
> words, ticked `- [x]` for the ones they confirmed and left unticked for the ones they did not. An
> unticked line is data — it is a statement they declined, and it stays on the map so nobody re-asks.
> **Close with what the extraction reshaped**, naming the decision row it changed. An extracted fact
> that changes nothing does not need to be on the map.

## Unknown unknowns — the landmine cards

The sweep covered the 6 files this task touches: `anchor.rs`, `store.rs`, `lib.rs`, `input.rs`,
`export.rs`, and `tests/session.rs`.

### A duplicated line steals the comment — decided

- **Evidence:** `harness/apps/line-comment/server/src/anchor.rs:151` — when the stored line no longer hashes to the stored hash, the search takes the hash-equal line *nearest* the stored line, and source files are full of identical lines (`}`, a blank line, a repeated `return nil`).
- **Why it bites:** the comment lands on a different line and looks perfectly healthy. Nothing marks it, so the user reads it as an annotation on code it was never written about.
- **What it changes:** this is the failure the whole task exists to remove, and it is why question 2 was answered with three hashes rather than a better tie-break.

### An unreadable store silently becomes an empty one — OPEN

- **Evidence:** `harness/apps/line-comment/server/src/store.rs:87` — `fs::read_to_string` failing for *any* reason returns `Ok(Store::default())`, so a permission error is indistinguishable from a first run. The next `PersistStore` then writes the empty store over the real file.
- **Why it bites:** every comment in the workspace is gone, with no message and no backup. Only the unsupported-version and malformed-JSON paths report anything (`lib.rs:85`).
- **What it changes:** the version bump in question 3 walks straight into it — a store that cannot be read is the exact case a version bump is supposed to make safe. **OPEN:** unblocked by the user saying whether this task fixes it or files it.

### A renamed file leaves comments nothing reads — sharp edge

- **Evidence:** `harness/apps/line-comment/server/src/lib.rs:437` — `reconcile_all` skips a file it cannot read, deliberately, because a missing file is not evidence the text is gone. No other path removes a key.
- **Why it bites:** comments accumulate under dead paths forever and are counted by `total()`, so the count the user sees is larger than the comments they can reach.
- **What it changes:** nothing in this task. Noted so a later "why is the count wrong" question has an answer already on the map.

> Landmine discovery and status rules are `sub-unknowns.md` § 4.
> **Three fields, all three required, in this order:** **Evidence** (a `path:line` and the fact it
> shows), **Why it bites** (the failure a user would actually experience, not that the code is ugly),
> and **What it changes** (which decision row this reshapes, or `nothing in this task`).
> **A card marked OPEN says what unblocks it**, in the same form as an OPEN ledger row. A card marked
> decided points at the ledger row that decided it. A sharp edge needs no decision — it is recorded so
> the next reader does not re-find it.

## Build plan

Sorted by how likely each step is to be tweaked, judgment calls first.

1. Answer questions 4 and 5, both OPEN. Nothing below is safe to start first.
2. Choose the three-hash anchor's match threshold — two of three, or the first and last only. Alternatives stay in the code as one constant.
3. Bump `STORE_VERSION` to 2 and decide the old-store path (question 5).
4. Mechanical, collapsed: extend `Comment` with the two neighbour hashes, thread them through `line_hash`/`rehash`/`reconcile`, and update the nine tests in `tests/session.rs`.

> Optional, and it **accompanies the map, never replaces it**. Sort by likelihood of being tweaked —
> the judgment calls first, with their alternatives named, and the mechanical work collapsed into one
> line at the bottom. A step that depends on an OPEN row says so.

## Copyable implementation prompt

```
Implement the three-hash anchor in harness/apps/line-comment/server: extend Comment with the hashes
of the line above and below, count a two-of-three match as found, break a distance tie toward the
earlier line, and bump STORE_VERSION to 2. Keep the orphan path exactly as it is. Read
.notes/research/anchor-rule.unknowns.md first — questions 4 and 5 there are answered as: <answers>.
```

> The user's next message, pre-drafted, in a fenced block they can copy without editing prose. It
> names the map file, and it leaves one `<...>` slot per still-OPEN row rather than guessing the
> answer. **Done when the user holds the map** — implementation is a separate task that starts after
> the hand-over, so this block is the hand-over, not the start of the work.
