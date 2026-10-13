---
name: tactical-design
description: >
  Tactical design principles for the code level (C4 level 4) — types, interfaces, functions, and the
  fields and branches inside them. Use when designing the types or interfaces of a change, when a spec
  or a diff adds a kind field, a mode parameter, or a kind branch to an existing type, and when the
  user asks whether an abstraction fits.
---

# Tactical design

Principles for the code level: types, interfaces, functions. To judge a design or a diff, list every type, interface, port, record, and table it creates or changes, and check each one against every principle. Cite a breach by the principle name.

## Principles

### Conceptual integrity

**A new need is a new instance, not a new exception** — never a field or a branch inside a type that exists.

### One name, one job

**A type name is true for every need the type serves.** When the name is false for one need, that need goes to another type. When the one-line description of a type needs "and", it is two types. Known as the Single Responsibility Principle.

### Stable field meaning

**A field carries one fact, every instance fills it, and a change keeps its meaning.** A field that only one kind of need fills, or a field that exists only to restore the old meaning of another field, shows a broken concept. Put the new fact in a new instance or a new abstraction.

### Wrap shared behavior

**Behavior that many instances need wraps an instance.** Logging, auth, retry, and timeouts are middleware or a decorator, not code inside each instance. Known as the Decorator pattern.

### Follow the local pattern

**A new instance copies the structure of the instances that exist** — the constructor shape, the method set, the file layout. When the request says "do X like Y", copy Y from the real code, not a better variant of it.

### One way per job

**The codebase does one job in one way** — one way to read a state, one way to start a run. Search the codebase for the job before you accept a second way. Known as DRY.

### Change the abstraction, not the need

**When a need does not fit, make the change easy, then make the easy change** (Kent Beck). A need does not fit when another principle fails for it. Choose one fix and name it: widen the contract and move every existing instance to it, or give the need its own abstraction.
