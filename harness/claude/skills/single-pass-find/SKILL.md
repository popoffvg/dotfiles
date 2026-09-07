---
name: single-pass-find
description: Use when writing or reviewing a find-then-use flow — a lookup/find/search method and its caller — to avoid redundant passes over the same data. Triggers on a finder that collects a whole collection into a slice then scans it again (slices.Index/IndexFunc, LINQ, filter().find()), or a caller that re-fetches by key what the finder already returned.
---

# Single-pass find-then-use

Eliminate the second traversal in a lookup-then-consume flow.

## Finder: verify in place, return the full record

A finder that scans a bounded collection checks the predicate DURING its single iteration and returns the matched element (whole record, not just its key/id). It never collects everything into a slice and then scans that slice again.

```
// bad — two passes: build all, then scan all
all := []
for it.Valid() { all = append(all, it.Value()); it.Next() }
i := slices.IndexFunc(all, match)   // second pass
return all[i]

// good — one pass: match in place, return the full record
for it.Valid() {
    v := it.Value()
    if match(v) { return v, true }  // caller needs no second lookup
    it.Next()
}
return zero, false
```

An in-place single-pass scan cannot use `slices.Index`/`IndexFunc` — those require a materialized slice, i.e. the extra pass being avoided. If an earlier instruction said "use slices.Index", the single-pass requirement overrides it.

## Caller: use what the finder returned

When the finder already returns the full record, consume it directly. Never re-`Get`/re-query by key for a record just handed back.

```
// bad — finder returns the record, caller looks it up again
found, ok := store.FindBy(x)
rec, _ := store.Get(found.Key)   // redundant lookup

// good
rec, ok := store.FindBy(x)       // full record; use it
```

On the fall-back / create branch (finder found nothing), construct the record with every field already known — don't leave attributes to a later merge if they're in hand at construction.
