---
name: go-component-structure
description: Go constructor and field rules — every set-up step runs inside the constructor, callers wait for every constructor input, entry points check outside input first, a non-pointer field with a plain getter becomes an exported field, and a type calls no private method of another type. Use when you write or change a Go type, its constructor, its fields, or the file that holds it.
paths:
  - "**/*.go"
---

# Go Component Structure

## Constructors

- A step that every new value needs MUST run inside the constructor. The caller MUST NOT call a fill or set-up method after construction.
  - good: `NewInstallation(engine, loaded, listed, rollout, session)` fills the document from `session` before it returns.
  - bad: `install := NewInstallation(...)` followed by `install.FillFromSession(session)`.
- A value that the constructor needs MUST be a constructor parameter. Make the set-up method private, or delete it.
- The caller MUST wait until every input of the constructor is ready. It MUST NOT build the value early and correct it later.
  - good: the screen requests the installation list only after the session and the latest version both arrive.
  - bad: the screen lists first, then writes the late session onto every listed value.
- An entry point that needs an input from outside MUST get it and check it before it does any work. It MUST stop with an error when the input is missing or empty.
  - good: the apply command calls `DescribeSession`, then refuses a session with no region before it lists.

## Fields and getters

- A field that is not a pointer and has a getter that only returns it MUST be an exported field. Delete the getter. Move the getter's doc comment to the field.
  - good: `Settings InstallationSettings` and `LoadErr error` as fields.
  - bad: `loaded InstallationSettings` with `func (i *Installation) Settings() InstallationSettings { return i.loaded }`.
- A pointer field, or a field that a mutex guards, MUST stay private behind its getter.
  - good: `rollout *Rollout`, which `rolloutMu` guards and `Rollout()` reads.
- When a field becomes exported, the type doc MUST still be true. Correct every sentence about "the exported fields".

## Calls between types

- A type SHOULD NOT call a private method of another type, even when Go allows it inside one package. Call an exported method, or move the logic to the type that owns the data.
  - good: `Installation` calls `rollout.Status()`.
  - bad: `Installation` calls `rollout.status()`.
