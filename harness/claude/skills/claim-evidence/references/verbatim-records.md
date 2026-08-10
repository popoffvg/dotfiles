# Quote the source row, don't summarize it

Paste the record verbatim under each claim. A paraphrase plus `file:line` forces the reader to
open the source to check the claim — and hides the evidence that makes the claim obvious.

## Procedure

1. **Extract the rows mechanically.** Pull each cited line by number from the source; never
   retype it from memory.
2. **Paste it verbatim, prefixed with its line number.** Normalize only column-alignment
   whitespace. Say so once, up front, so the reader knows the cell text is untouched.
3. **Quote the header row once per source section**, so the reader can map the columns.
4. **Group the duplicates/outliers side by side.** Rows that share a column set convict
   themselves when adjacent; a prose summary of the same rows does not.
5. **Elide only when a row is already quoted in full elsewhere.** Mark the cut with `…` and
   state that convention.
6. **Verify the quotes, then report the count.** Re-read each cited line, normalize whitespace,
   compare to what the report claims. Publish the tally — `103 exact / 3 elided / 0 mismatched`
   — because a report built on quotes is worthless if a quote drifted.

## Why verbatim beats paraphrase

The source's own wording is usually stronger evidence than anything written about it. Records
convict themselves: `(alternate to blockId)`, `Alias of …`, `(also see overlap)`, `(legacy /
alternate namespace)`. A paraphrase drops exactly those words, and with them the proof.

Two adjacent rows with an identical column set are a finding the reader sees in one glance. The
same pair described in a sentence is a claim they must take on trust.

## Keeping wide rows readable

Verbatim does not mean unreadable. When rows are padded or very wide:

- Squeeze alignment padding to single spaces.
- Put the block in a fenced code block, not a markdown table — a pasted table row renders as a
  broken table.
- Cut columns irrelevant to the claim only if the full row appears elsewhere, and mark the cut.

Never trim a row's *content* to fit. If a value set is the finding, the value set stays whole.

## Scope

Applies to any report over structured records: p-column/spec catalogs, config key inventories,
CSV/TSV extracts, dependency manifests, log-line audits, glossary tables, permission matrices.
Does not apply to narrative prose sources — quote a sentence there, not a "row".
