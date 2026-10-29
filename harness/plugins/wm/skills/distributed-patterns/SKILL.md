---
name: distributed-patterns
description: "distributed-patterns: how many writers share one store with no compare and swap and no shared lock — unique names, write-once objects, the child before its link, a fixed winner rule, and a housekeeper with a grace period. Use when you design or review a write path that several processes or instances run against one bucket, folder, or table, or when a design needs a CAS or a lease only to keep two writers apart."
---

# distributed-patterns — write what cannot collide, link it last, collect what nobody links

Apply every rule below to each write path before you show the design to the operator. Each rule removes one thing that would need a compare and swap (CAS) or a lock. A path that breaks a rule MUST name the CAS or the lease it uses in its place.

## Rules

| Rule | Replaces | Rule text |
|---|---|---|
| `unique-name-no-claim` | a CAS create that claims an id | An object name MUST NOT collide between writers: use a writer id with a random suffix, or a content hash. A name that two writers can make (a one-second timestamp, a counter) needs a claim, and a claim needs a CAS. |
| `write-once` | an update on the version that was read | An object MUST NOT be overwritten. A change is a new object with a new name. |
| `child-before-link` | a lock across two writes | A record MUST be written after every object it links to. A reader then never finds a link to a missing object, and a crash leaves only unlinked objects. |
| `link-by-new-object` | a CAS on a pointer key such as `current` | A new state MUST be published as a new record (`<key>/<writer>-<seq>`), not as an overwrite of one key. |
| `deterministic-winner` | a lock that lets one writer win | A reader that finds two records for one question MUST pick one with a fixed rule that every reader applies the same way, for example the highest `(seq, writerID)`. A set (snapshots, ids) needs no winner: the reader takes the union. |
| `unlinked-is-garbage` | a rollback | A failed or cut operation MUST NOT undo its writes. The housekeeper deletes each object that no record links to. |
| `grace-before-delete` | a lock between a write and a delete | The housekeeper MUST NOT delete an unlinked object younger than a grace period longer than the longest write, because an orphan and a write in progress look the same. Mark on one pass; delete on a later pass if the object is still unlinked. |
| `idempotent-retry` | exactly-once delivery | A retry MUST write the same name with the same bytes, or a new name that the winner rule ignores. |

```text
operation (any writer, any time, no lock)
  write the children under unique names       # unique-name-no-claim, write-once
  write the record that links them            # child-before-link, link-by-new-object
reader
  list the records → pick by the fixed rule   # deterministic-winner
housekeeper
  unlinked and older than grace → delete      # unlinked-is-garbage, grace-before-delete
```

## The limit

These rules cannot make one action exclusive: "exactly one process owns this instance", "this id is used once". Exclusivity needs agreement, and agreement needs a conditional write, a lease, or a store that gives a strict total order of writes. Use the rules where a duplicate is harmless and the reader resolves the conflict. Where "who was first" changes the result, keep the CAS or the lease, and draw it in the Flow of the TODO.

## Worked case

An instance record named a one-second generation id, and the record was written before `G<id>/metadata`. When another instance had already taken the id, the record had to move to a new id under a CAS, and the move could fail. That needed a move function, a move error, and a branch that finished a cut start. Rule `child-before-link` turned the order around: the metadata first, the record second. The move, its error, and the cut-start branch went. A crash between the two writes leaves a generation that no record links to, and the housekeeper removes it (`unlinked-is-garbage`). The metadata create still claims the id with a CAS, because the one-second id breaks `unique-name-no-claim`.
