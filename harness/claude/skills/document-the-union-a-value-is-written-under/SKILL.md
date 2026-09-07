---
name: document-the-union-a-value-is-written-under
description: Use when writing or reviewing the sentence that tells a reader what a status value means — an enum's doc comment, a UI legend or tooltip, a column description, a state-machine table — and especially when a change gives that value a second writer while leaving the value set frozen. Derive the sentence from every branch that assigns the value, not from the meaning the task intended; a legend that names one branch of a disjunction is a documented lie the tests cannot catch.
metadata:
  origin: self-improvement
---

# Write the legend from the assignment conditions

A status value means exactly the disjunction of the conditions under which code writes it. When a
change adds a second producer but the value set is frozen — the usual outcome of "do not touch this
enum" — the value's meaning is **widened**, not replaced, and the intended new meaning is only one
branch of it. A legend stating that branch reads confident and is wrong for every case from the
other branch. No test fails: the tests assert the value, the prose asserts the meaning.

**Before writing the sentence, grep every assignment of the value and read the guard on each.**
Then state the union, with the "or" visible:

> `variant` = a candidate was built and a gate turned it away, **or** the parent shipped a variant
> carrying no edit from this row's objective.

Rules that follow:

- Update every site that carries the sentence in the same edit — the type/enum doc, the UI legend, the column description, the docs page. They drift as a set.
- A committed test that contradicts your draft sentence is the authority, not the draft. Read the fixtures that assert the value and check each against the sentence before shipping it.
- **If the union will not read as one coherent idea, the enum needed a new member, not a widened one.** Say so and raise the frozen-surface constraint with whoever froze it, rather than writing prose that papers over two unrelated states.
