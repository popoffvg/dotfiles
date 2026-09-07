---
name: audit-the-named-section
description: Use when asked to audit, dedup, inventory, or review one named part of a larger structured document — a section of a catalog or spec, one sheet of a workbook, one table, one config block, one package of a monorepo. Keeps the named part as the deliverable instead of widening the sweep to adjacent parts. Triggers on "find duplicates in <section>", "audit the <X> keys", "review the <X> table", or any ask that names a subdivision of a document that has several.
metadata:
  origin: self-improvement
---

# Audit the section that was named, not its neighbors

Make the named subdivision the whole deliverable. Widening to adjacent sections reads as
thoroughness and costs depth: attention spreads, and findings that only appear on a careful
pass through the named part go unfound.

## Procedure

1. **Fix the line range before reading.** Locate the named section's start and end. Every claim
   in the report must cite inside it.
2. **Sweep that range exhaustively.** Re-read every row, not only the ones that looked
   promising on the first pass. Group by role and by value set, both directions.
3. **Check the section's own stated contract.** A section usually declares what its entries are
   for ("different domain ⇒ different concept", "one row per user"). Entries that fail their own
   contract are findings, and they are only visible when reading the section as a unit.
4. **Put cross-section findings in a labeled appendix**, named as out of scope, with a line
   offering to fold them in. Never delete them silently and never let them pad the body.
5. **Verify the scope mechanically.** Extract every line number the report cites and assert each
   falls inside the range. Report the result.

## Why the wide sweep loses findings

Whole-section reading is what surfaces distribution facts — "15 of 76 keys serve one role",
"5 entries have a single possible value", "this field is encoded three different ways". None of
those are visible from a single row, so a pass that samples across three sections cannot see
them. A narrow scope is more thorough per row, not less thorough overall.

## On an ambiguous name

When the named part could denote either a subdivision or the whole document, audit the
subdivision first and say which reading was taken in one line. That yields a usable deliverable
under either reading. Widening first yields a shallow pass under both.

## Verify the scope

```python
# every cited line must fall inside the named range
out = [n for n in cited_lines if not (START <= n <= END)]
print(f"lines cited outside the section: {sorted(set(out)) or 'none'}")
```

Pair with `quote-the-source-row` — a scoped audit still quotes each cited row verbatim.
