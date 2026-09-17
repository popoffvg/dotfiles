---
name: searchable-names
description: >
  Use when choosing a name that a person or a grep must land on later — a type, function, method,
  field, constant, file, module, package, test, metric, event, feature flag, error code, or the name
  of an app or directory being renamed — and when writing the doc line under a new public symbol or
  building a string literal from parts. Covers one term per concept, domain words over technical
  ones, 2–4 word public names, one concept per file, naming a file after its concept and never a
  role (`types`, `utils`, `helpers`, `config`), keeping metric and event strings whole, and a unique
  literal prefix on every error and log message. Triggers on "what should I call this", "rename
  this", "where should this file go", "add a new module", "align the terminology", or a name you are
  about to commit. Judging the names a finished diff already declares is `pedant`, not this skill.
user-invocable: false
---

# Searchable names

Every name, string, and doc line is read by a plain-text search, and read once. Put each fact where
that search lands, in the shortest form that still forces the behavior.

This skill picks the name while the code is written. `pedant` attacks the names a finished diff
already declares — its smell table is the review gate, not this list.

## Align language

- One term per concept across code, tests, docs, commits. A synonym splits every future search.
- Name types and methods after domain terms, not tech (`placeOrder`, not `insertOrderRow`). If the domain and the code disagree, rename the code.
- When behavior or audience changes, rename in the same commit. A private helper that other modules now need gets a public name, not a re-export shim.

## Name the symbol

**Give a public name 2–4 words, one of them a domain word.** Use the shortest name that greps uniquely, then stop, and put the rest in the doc line. Good: `DiffResourceFields`, `QueueEventForDispatch`. Bad: `Diff`, `Queue`, `Format`.

**Give a generic verb its object.** `validateRunnerConfig`, not `validateConfig`.

**Do not lean on the module path to disambiguate.** A search for `Diff` lands on the definition, which says only `Diff`; `runner.Diff` reads well at the call site alone.

**Keep one definition site per symbol.** Never copy a function into a second file. Move it, and delete the original in the same change.

## Name the file

**Name a file after its concept, never after a role.** `types`, `utils`, `helpers`, `config` say nothing in a search result, and they collide with the same file in every other module. The base name is the component that declares the type, and each extra file adds a suffix to that base: `client` → `client_bucket`, `client_federated`, and the test beside it → `client_federated_test`.

**One searchable concept per file, and thin orchestrators.** The code that answers "where is X done?" lives in the file named after X. An orchestrator reads as a sequence of calls into well-named functions, each one hop from the real work. Split until each question-sized concept has one home, then stop — a helper with meaning inside one concept stays inline.

## Put the domain concept in a type, not in a comment

- Declare a named type (`ResourceID`) and never pass a bare primitive for a domain id. `transfer(ownerID, orgID)` on two integers hides a transposed argument; a named type makes it a build error.
- For a privileged operation, take a capability type that already carries the access scope, not a raw handle.
- Model state as an explicit enum or a sealed set of variants, not a group of nullable fields with implicit rules about which combinations are legal.
- Every untyped escape hatch (`any`) is a place the compiler goes silent.

## Write the constraint where the search lands

Give every public symbol one doc line that states the sharpest fact the signature cannot show — the unit, the timezone, the owner, the order, the lifetime, who must release the resource. Add the plain-words phrase a person would search for, because `SessionExpiryChecker` does not match a grep for "session expired". Good: `SessionExpiryChecker reports whether the user session has expired.` Bad: `SessionExpiryChecker implements ExpiryCheck.`

How the prose of that line is written — the word budget, the voice, the deletion test — is `CODE_STYLE.md` § DO NOT DO, and `wm:agents/comment-critic.md` § The sentence shape.

## Name the literal

**Keep strings whole.** Never assemble a metric name, a resource type, an event name, a feature flag, or an error code from parts: `"pl_" + kind + "_total"` makes `pl_upload_total` impossible to find. Write the full literal, even where a loop looks DRYer.

**Start each error, wrap, and log message with a unique literal prefix**, so a line copied from a log greps back to its origin. Good: `"webhook signature mismatch for resource %d"`. Bad: `"%s: mismatch"`.

**Mark a dead end with the language's deprecation marker and a pointer to the replacement.** It goes after the doc line, never in place of it.

Before you commit, read this skill against the diff.
