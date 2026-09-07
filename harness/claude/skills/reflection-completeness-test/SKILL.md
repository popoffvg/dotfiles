---
name: reflection-completeness-test
description: Use when writing a test that guards against a struct gaining a new field a mutator/merge/overlay/serializer method silently doesn't handle. Applies whenever the guard would otherwise be a hardcoded map of field names to "handled" status.
---

# Reflection completeness test: assert behavior, not presence

A completeness guard that only checks a field name exists in a hand-maintained
map (`fieldOwner["Email"] = "Merge"`) proves nothing about behavior. The map
entry can be wrong, or the method it names can silently stop touching the
field, and the test still passes — it only checked that *some* string is
present for that field name.

## The fix: default-to-changed, explicit opt-out

For a method that overlays/merges fields from one value onto another:

1. Declare a small `untouched` set — field names the method must NOT touch
   (e.g. an immutable key, or fields owned by a different method).
2. Build an `existing` value and a fully non-zero/distinct `incoming` value.
3. Call the method under test.
4. Walk the struct's fields via `reflect.TypeFor[T]()`:
   - Field **not** in `untouched` → assert `got.Field(i) == incoming.Field(i)`
     (the method must have overlaid it — this is the default expectation).
   - Field **in** `untouched` → assert `got.Field(i) == existing.Field(i)`
     (the method must not have changed it).

A new struct field with no entry in `untouched` now fails at the *assertion*
(wrong value, not "missing map key") the moment someone adds it — the default
assumption is "the method changes it," which forces an explicit, visible
opt-out for anything that legitimately shouldn't change.

```go
func TestX_Merge_ChangesAllFieldsExceptUntouched(t *testing.T) {
    untouched := map[string]bool{"ID": true} // immutable key

    existing := X{ID: "a"}
    incoming := X{ID: "b", Name: "new", Count: 99} // every other field non-zero/distinct

    got := existing.Merge(incoming)

    existingV, incomingV, gotV := reflect.ValueOf(existing), reflect.ValueOf(incoming), reflect.ValueOf(got)
    typ := reflect.TypeFor[X]()
    for i := range typ.NumField() {
        name := typ.Field(i).Name
        if untouched[name] {
            require.Equal(t, existingV.Field(i).Interface(), gotV.Field(i).Interface(), "field %s must not change", name)
            continue
        }
        require.Equal(t, incomingV.Field(i).Interface(), gotV.Field(i).Interface(), "field %s must be overlaid", name)
    }
}
```

## Sanity-check the guard itself

Before trusting it, break the method under test (comment out one field's
overlay line) and confirm the test fails with a message naming that exact
field. A completeness test that can't fail this way is decorative.

## When NOT to use this

- The method has field-specific conditional logic beyond plain overlay
  (e.g. "update only if incoming is non-zero", "preserve first, update
  last") — those need their own targeted behavior tests; this pattern only
  covers the binary "does it change / does it not" split. Keep both: the
  targeted tests for the conditional cases, this test as the coverage net.
- If the struct owns two or more mutation methods, don't fold them into one
  map/test — write one reflection completeness test per method, each with
  its own `untouched` set. Mixing multiple methods' semantics into one field
  map is how the presence-only anti-pattern started.
