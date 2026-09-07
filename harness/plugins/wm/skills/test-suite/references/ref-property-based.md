# Property-based — the technique that writes the cases you would not

Every other technique in [`sub-case-design.md`](sub-case-design.md) picks the **inputs** and you
write the assertion. This one inverts it: you write an assertion that holds for the whole input
domain, and a generator hunts the counterexample.

**In:** one function, or two the caller says should agree. **Out:** one big case per property,
plus the generator in the test source. **Done when** every row of § The catalog has been either
asserted or rejected on the evidence rule, and every rejection is named in **Not covered**.

**A property is not always available, and saying so is a valid outcome.** Code with no algebraic
shape gets example tests. Before concluding there is none, run § Expose a property that is buried
— a calculation wrapped in I/O has a property and no seam to assert it through.

## The evidence rule — the whole technique rests on it

**Only assert a property the code already claims.** The claim lives in a doc comment, a type, a
comment, an external spec, or the way callers use it. A property you merely believe is true
produces a red test that is not a bug, and one such failure teaches the team to ignore the suite.

Sources, in descending authority:

| Source | What it settles |
|---|---|
| External spec — RFC, format definition, proto | the real contract, when one exists |
| Type signature | return type, nullability, the domain |
| Doc comment | the stated guarantees and preconditions |
| Existing tests | the contract the maintainers believe they have |
| The name | weakest, and the most misleading — plenty of `normalize` do something narrower |

Read the source, the doc line, and two or three call sites before proposing anything.

## The catalog

| Property | Shape | Where it lives |
|---|---|---|
| **Round trip** | `decode(encode(x)) == x`, `parse(format(x)) == x` | serializers, codecs, migrations |
| **Oracle** | `new(x) == reference(x)` | every refactor, rewrite, and optimization |
| **Inverse pair** | `f(g(x)) == x` — encrypt/decrypt, compress/decompress, add/remove | stores, registries, caches |
| **Idempotence** | `f(f(x)) == f(x)` | normalizers, formatters, reconcilers, retried writes |
| **Invariant** | a statement that holds before and after | any transformation, any stateful resource |
| **Cheap checker** | `is_sorted(sort(x))` — verifying is easier than computing | complex algorithms |
| **Commutativity** | `f(a,b) == f(b,a)` | binary and set operations, merges |
| **Associativity** | `f(f(a,b),c) == f(a,f(b,c))` | combining operations |
| **Identity** | `f(x, e) == x` | operations with a neutral element |
| **Confluence** | order of application does not change the result | rule engines, optimization passes |
| **Metamorphic** | `f(x)` and `f(g(x))` relate although neither value is known — `sin(π−x) == sin(x)` | anything whose right answer you cannot compute |
| **Determinism** | `f(x) == f(x)` | only where impurity could falsify it — map iteration order, hashing, the clock |
| **Does not crash** | any valid input returns or raises a **declared** error | parsers and other one-entry-point libraries |

**Assert the strongest property the code supports.** Weakest to strongest:
`does not crash → type preserved → invariant → idempotence → round trip / oracle`. Does-not-crash
alone rarely repays the generator dependency; if that is all you find, either a small rearrangement
exposes something stronger or the honest report is that this code is a poor candidate.

**Oracle is the highest-value row in a refactor** — the old code is the oracle, so the property
costs nothing to invent.

## Write the generator against the domain the callers guarantee

**Put the constraint in the generator, never in a post-generation filter.** A filter discards
inputs after they are made, so a narrow one burns the example budget and then trips the
exhausted-filter guard, which surfaces as a warning nobody reads. Reserve the filter for a
relationship between two already-drawn values.

```python
@given(st.integers())          # slow, mostly discarded
def test_positive(x):
    assume(x > 0)

@given(st.integers(min_value=1))   # generates only what the code accepts
def test_positive(x): ...
```

**Prefer sound over complete.** A generator that only produces inputs the code accepts, even
though it misses some, beats one that produces inputs no caller can send. 90% of the domain is
enough; do not chase the rest. Equally, do not narrow past the code's own limit — cap a
collection's size only where the code caps it.

**Find the real domain in the callers.** Trace two or three call sites and record the implicit
preconditions, especially for an internal helper, where the assumptions are the least documented.

**Pin the edges you already know.** A generator finds a boundary eventually; a pinned example
finds it every run and records that you thought about it — empty, single element, all duplicates,
zero, negative, and the maximum representable value are the ones that recur.

**Set the example count and drop the deadline per workflow** — a handful locally, a couple of
hundred in CI, a thousand nightly. A default per-example deadline turns a slow machine into a red
test, and that flake is what gets the whole suite deleted.

## The two ways a property test asserts nothing

- **Tautology** — the assertion restates the implementation, so no bug the two share can fail it.
  `assert add(a,b) == a + b` over `add = a + b` survives anything. Reach for an algebraic law
  instead, which constrains the function without recomputing it. The exception is determinism:
  `f(x) == f(x)` is real wherever impurity could falsify it.
- **Vacuity** — a filter that rejects nearly every input passes without exercising anything, and a
  self-contradictory one passes having run zero cases. A filter pinned to a single value is an
  example test wearing a generator.

## Triage every failure before calling it a bug

A red property test is a claim. Three checks, in order:

1. **Reproducible** — the shrunk input fails again in a standalone script, every run.
2. **Legitimate** — a caller can really send that input, no caller validates it away first, and
   the property is one § The evidence rule found a claim for.
3. **Material** — it breaks a documented guarantee or an expectation a real user holds.

| Symptom | Cause | What to do |
|---|---|---|
| Violates a documented guarantee | code bug | report it with the shrunk input and the doc quote |
| Input violates a documented precondition | over-broad generator | constrain the generator, rerun |
| Property contradicts the doc line or the type | wrong property | fix the property |
| Edge the spec never decided | ambiguous spec | a question for the owner, not a bug report |
| Goes away under realistic constraints | test artifact | fix the generator |
| Differs from a sibling function | possible inconsistency | raise it, flagged as uncertain |

A precondition violation is not a bug. **Report the ambiguous ones out loud** — "the spec never
decided this, someone has to" — because a finding you swallow cannot be triaged by anyone else.

A green property test gets one check too: does it reach the real implementation, or a wrapper that
delegates the logic somewhere else?

## Expose a property that is buried

"No algebraic shape" is usually a fact about how the code is arranged. Propose the rearrangement,
name the property it unlocks, and let the author decide — strongest first.

1. **Extract the pure core.** I/O at the edges, calculation in the middle, assert the middle. The
   highest-value move by a wide margin, and why most "untestable" code is testable. The same
   applies to anything whose observable is a side effect: build the message, the request, the
   query object, then send it.
2. **Add the missing inverse.** Unlocks round trip, the strongest row. Worth asking for even where
   production never decodes — a serializer nobody can read back is usually a latent bug.
3. **Split the value from its rendering.** String building by concatenation has nothing to assert
   beyond "contains"; a structured value plus a renderer and a parser is a round trip, and it is
   where quoting and escaping bugs live.
4. **Return a value instead of mutating in place.** An in-place mutation destroys the input you
   wanted to compare against. A copying wrapper is enough when the signature has to stay.
5. **Inject the dependency.** A function reading a global or the environment can only be tested at
   whatever that happens to be, so the boundaries where validators break are unreachable.

**Skip the suggestion** when the property it unlocks is only does-not-crash, when the module needs
wholesale restructuring (say that once, plainly), or when the refactor breaks a public API — flag
it as breaking and offer the compatible version. Run the existing tests after any such change and
say that you did.

## The library is the project's, and adding one is the user's call

Use whatever the project already has. Where there is none, adding a generator is a dependency
decision — offer it once with the specific property you would write, and take the answer either
way. The one non-obvious pick: Solidity state invariants run under Echidna or Medusa, not a
unit-test generator.

## The collapse

**One property is one big case, named after the claim** — `## Any encoded record decodes back to
itself`, never `## Property 3`. The generator, the pinned examples, and the shrunk counterexample
live in the test source; the saved document carries the sentence and the technique that produced
it, in the shape [`ref-readable-output.md`](ref-readable-output.md) defines.

In a wm TODO's `## Autotest`, a property backs one bold claim group in place of its example
bullets, with the Outcome as the claim source — shape owned by `arch:ref-todo-sections.md`
§ Autotest.
