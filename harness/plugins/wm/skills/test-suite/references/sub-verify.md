# Verify — audit an existing test set

Score a test set on two axes: does it **cover**, and can a human **read** it. A set that covers
everything and reads as thirty rows under four cryptic columns fails, because nobody will
maintain what nobody can follow. The shape it is measured against is
[`ref-readable-output.md`](ref-readable-output.md).

## What the audit returns

1. **Score** out of 100
2. **Critical gaps** — must fix before merge
3. **Non-critical gaps** — should fix next
4. **False or weak assertions**
5. **Readability defects** — where the document hides its own content
6. **Coverage defects** — requirements with no case, cases with no requirement
7. **Patch plan** — the smallest set of edits that closes the above

Name every finding by the case it belongs to. When the set under audit still uses slugs, quote
the slug once and give the case the name it should have carried.

## Scoring

| Dimension | Points |
|---|---|
| Requirement coverage | 25 |
| Negative and boundary depth | 20 |
| Resilience and failure-mode depth | 15 |
| Assertion quality — observable oracles | 15 |
| Readability — the contract in `ref-readable-output.md` | 15 |
| Environment and preflight realism | 5 |
| Determinism and flakiness control | 5 |

**Two hard gates, either of which returns Not Ready whatever the score.** A P0 path or a safety
condition with no case fails, because the set does not do its job. A document with no function
block and no behaviour headings also fails, because the set cannot be reviewed — the reader has
no way to tell a missing case from a case they did not understand.

## Coverage invariants

- No requirement is untested.
- No case without an explicit oracle.
- No path covered by its happy case alone.
- No hidden assumption about a dependency.
- No retry loop without a termination criterion.
- No assertion that says "works" or "succeeds".

## Assertions that pass while proving nothing

Judged under **False or weak assertions**, worst first. The first two are critical on their own:
a test in either state has never been able to fail.

| Defect | Severity | How it shows up |
|---|---|---|
| Tautological | critical | the assertion holds whatever the implementation does — `assert result == result` |
| Vacuous | critical | the input filter rejects nearly everything, or contradicts itself, so zero cases ran |
| No assertion | high | the body calls the thing and stops |
| Reimplementation | high | the assertion recomputes the function's own logic, so any shared bug survives |
| A stronger property was available | medium | length checked, ordering never — see [`ref-property-based.md`](ref-property-based.md) |
| Filtered where the generator should constrain | medium | stacked input filters in place of a narrowed generator |

`f(x) == f(x)` is the exception to the first row: it is a real determinism property wherever
impurity could falsify it — map iteration order, hashing, the clock. Ask whether a broken
implementation could fail it. If yes it is a property; if no it is noise.

Also flag, whatever the score: float equality with no tolerance, an assertion on map or set
iteration order, and anything reading the clock. Each one produces a flake that gets blamed on
the generator, and then the suite gets deleted.

## Readability invariants

Run the checklist in `ref-readable-output.md` section 7 over the document and report every failed
line as a readability defect. Each one costs points out of the 15.

Two of those lines carry most of the weight and deserve a written finding rather than a tick.
**A slug identifier is a defect on its own**, because it forces the reader to look a case up
before they can think about it. **A matrix left in the document is a defect**, because it hands
the reader the derivation instead of the result — a Mermaid state diagram is welcome, its
transition matrix is not.

## Missed-case checks

These five recur across sessions. Run them every time.

1. **Tooling preconditions** — is there a check that the linters, credentials, assets, and config
   are ready before the run, so a setup failure is not read as a defect?
2. **Stale-state protection** — do the cases re-read state after an action that changed it?
3. **Transient failure handling** — is there a case for a temporary transport or permission
   interruption, with a bounded retry or a fallback?
4. **Failure observability** — does the expected result name the failing subsystem and its
   message, instead of generic failure text?
5. **Regression lock** — is there a deterministic case for each defect that was reintroduced or
   fixed twice?

## Algorithm

1. Read the requirements and the case names.
2. Map requirement to case, both directions.
3. Scan for gaps by category — happy, negative, boundary, resilience, regression.
4. Judge the oracle of every case.
5. Run the readability invariants over the document as a whole.
6. Run the five missed-case checks.
7. Compute the score, apply the two gates, decide Ready or Not Ready.
8. Write the patch plan as concrete named cases to add or change.

## Verdict format

```text
Verdict: Ready | Not Ready
Score:   NN/100

Must fix now
  - <case-name> — <what is wrong>

Should fix next
  - <case-name> — <what is wrong>

Patch plan
  - <the one edit that closes it>
```
