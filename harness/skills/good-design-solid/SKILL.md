---
name: good-design-solid
description: This skill should be used when writing or changing code, or a markdown spec, plan, or design doc that adds or changes code, and the change adds or extends a type, class, struct, interface, record, method, field, kind or type branch, or constructor — or picks the architecture of a package (vertical slice, hexagonal ports and adapters, DDD bounded contexts). Also when the user says "SOLID", "single responsibility", "open/closed", "Liskov", "interface segregation", "does this abstraction fit", or "this type does too much".
user-invocable: false
---

# good-design-solid

These rules say how responsibilities split between types. The skill uses four of the five SOLID rules: SRP, OCP, LSP, and ISP. This skill owns the types, the interfaces, the fields, and the package style of a change. `good-design-dry` owns "does this exist already". `good-design-kiss` owns "is this part needed now".

## Steps

1. **List what the change touches.** List every type, interface, record, field, method, and constructor that the change creates or changes. Done when the list has each item with its `file:line`.
2. **Check each item against the rules below.** Run the checks of each rule on each item from step 1. Done when each item has `pass`, `fail`, or `n/a` for each check in the tables.
3. **Pick the package style before new types.** For a new package, or a package with no clear style, read [references/architecture-styles.md](references/architecture-styles.md) and name the style in the design. Done when the design names the style, or the package already has one and the change follows it.
4. **Change the abstraction, not the need.** When a need does not fit, make the change easy, then make the easy change. Choose one fix and name it. Widen the contract and move every instance that exists to it when every instance has the new fact. Give the need its own instance or wrapper when only some instances have it. Done when no item from step 1 carries a branch or a field that exists for one need only.
5. **Verify blind.** After the last edit, follow `## For the caller` in `~/.claude/agents/good-design-verifier.md`, once per change for all three good-design skills. Done when the verifier returns PASS or each finding is fixed or answered.

## The rules

### SRP: one name, one job

A type name is true for every need the type serves. When the name is false for one need, that need goes to another type. When the one-line description of a type needs "and", it is two types. A field carries one fact, every instance fills it, and a change keeps its meaning.

| Slug | Check | Evidence of a breach |
|---|---|---|
| `name-false-for-a-need` | Write the one-line description of each changed type. | The description needs "and", or the name is false for one of its methods. |
| `field-for-one-kind` | For each new field, list the instances that fill it. | Only one kind of instance fills it. |
| `field-meaning-changed` | Compare the old and the new meaning of each changed field. | Old readers now get a different fact, or a new field exists only to restore the old meaning. |

### OCP: a new type is open only where an extension is named

OCP applies only when the change designs a new type. This case is rare. For each new type, ask two questions: what in this type will be extended, and how will the next change land? An extension is named when a second kind exists now, or the user asks for it. With a named extension, design the type so that the next kind is a new instance or a wrapper, not an edit inside the type. Without a named extension, add no extension point, because `good-design-kiss` owns that. A step that two or more types need (logging, auth, retry, timeouts, metrics, a dry-run switch) is a named extension: wrap each instance in a type that implements the same interface, holds the inner value, and adds the step around the call. When one type needs the step, put the step inside that type.

| Slug | Check | Evidence of a breach |
|---|---|---|
| `edit-to-add-a-kind` | For each new type with a named extension, write the edit that adds the next kind. | The edit changes a `switch`, an `if`, or a field inside the new type, and does not add an instance or a wrapper. |
| `cross-cutting-flag` | Search the diff for a new flag or parameter that turns on logging, retry, a metric, or a check. | The step is a flag inside a type, not a wrapper, and two or more types need it. |

### LSP: every implementation keeps the contract

Each implementation of an interface accepts every input that the contract accepts, and gives every result that the contract promises. A caller never checks which implementation it holds.

| Slug | Check | Evidence of a breach |
|---|---|---|
| `refused-method` | Read each method of each new implementation. | A method that panics, returns "not supported", or does nothing for a call the contract allows. |
| `type-check-at-caller` | Search the diff for a type assertion, `instanceof`, or a kind check on an interface value. | A caller that picks behavior by the concrete type. |

### ISP: the interface sits with its consumer

A consumer takes the interface that exists. Declare a smaller interface in the package of the consumer only when the existing one gives the consumer a method that it must not call (a write on a read path), or when a second consumer needs a different method set.

| Slug | Check | Evidence of a breach |
|---|---|---|
| `unused-interface-method` | For each interface that a function takes, list the methods the function calls. | A method that the consumer must not call, or two consumers that need different method sets and share one interface. |
| `interface-beside-implementation` | Find the package of each new interface. | It sits with its one implementation, not with its consumer. |

The OCP checks are `n/a` for a type that exists, and for a new type with no named extension.
