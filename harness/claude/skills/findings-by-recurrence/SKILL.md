---
name: findings-by-recurrence
description: Use when turning a corpus of findings into recommendations — a bug retrospective, code audit, tech-debt inventory, review sweep, proposed lint rules, or a "what should we fix/require" list. Filters to what recurs across independent units instead of shipping every finding. Triggers on "only frequent mistakes", "what actually matters here", "too many proposals", "prioritize these findings", or any ask to narrow an audit's output.
metadata:
  origin: self-improvement
---

# Recommend by recurrence, not by inventory

An audit produces findings. A recommendation set is not the findings — it is the subset that
justifies permanent surface area (a doc section, a lint rule, a checklist line, a requirement).
Shipping every finding produces a document nobody applies.

**The filter: keep what recurs across independent units. Drop the rest to the per-item record.**

## Count independent units, not occurrences

The unit is whatever *shares no code* with its peers: separate repos, services, teams, packages.

- **N independent units hit it** → systemic. The shared cause is upstream — a doc gap, a missing
  guardrail, a bad default, an unwritable contract. Worth permanent surface.
- **One unit needed N commits** → that unit's problem, however dramatic the saga. Belongs in its
  record, not in the shared guidance.

Commit count measures *how hard one thing was to fix*. Unit count measures *whether it is yours to
fix centrally*. They are different questions and the second is the one a recommendation answers.

Default threshold: **≥3 independent units.** State the threshold; it is a judgement call and the
reader must be able to move it.

## Count at sub-pattern level — aggregates do not discriminate

Findings usually arrive grouped into classes. **Do not filter on the class.** Classes are built to
be broad, so nearly all of them clear any threshold, and the filter reports "everything is frequent".

Descend to the individual rule inside each class and count that. Expect the distribution to be
steep: a handful of sub-patterns at 5–8 units, a long tail at 1–2. The tail is usually the majority
of the findings and a minority of the value.

## Combine every window you have

If findings span multiple audits or time ranges, count across all of them before filtering. Patterns
routinely cross the threshold only when a later window adds units — those are the highest-signal
items, because they are actively spreading rather than historical.

## Write the dropped list

The dropped items, with their counts and where they came from, are not an appendix — they are what
makes the filter auditable and reversible. Without them the reader cannot tell a considered exclusion
from an oversight, and cannot re-admit something when a new instance appears.

## Two things the filter gets wrong on its own

**Invisible contracts.** A rule an author cannot deduce from the API — where the failure mode is
non-obvious and the code reads as correct — may sit below threshold while being encountered
constantly. Frequency of *commits* is not frequency of *encounter* when the mistake is only made once
per author. Keep such a rule and **label it as an override**, so the exception stays visible.

**Two authors, one unit, short window.** Below threshold, but the shape of something about to cross
it. Note it as a watch item rather than promoting or dropping it.

## Re-verify each premise against HEAD before proposing

A proposal derived from history can be **outdated**: the premise was remediated between the audit and
now. Check the current state of each rule's subject before recommending it. A remediated pattern does
not vanish from the recommendation set — it changes role, from *cleanup driver* to *regression guard*,
which is a much smaller piece of surface (a line, not a section).

## Expect the priority order to change

The unfiltered set is usually led by whatever produced the most commits. Under a recurrence filter,
the lead often shifts to **the mechanism that manufactures recurrence** — copy-paste between units,
a shared bad template, a default that every new unit inherits.

That mechanism outranks any individual class, because fixing it lowers future frequency across all
of them at once. Look for its signature: the same fix authored independently several times, and
especially **the same problem solved in contradictory ways in different units** — that means the
group now carries two incompatible answers to one question, and no amount of per-class work resolves
it.
