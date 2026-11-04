---
name: good-design-kiss
description: This skill should be used when writing or changing code, or a markdown spec, plan, README, or design doc that adds or changes code, and the change adds an interface, a generic or type parameter, an option, a flag, a config key, a wrapper, a layer, a new file or package, or a new dependency, or makes code "flexible", "configurable", "extensible", or "future-proof". Also when the user says "KISS", "YAGNI", "too complex", "over-engineered", "simplify", "too clever", or "in case we need it later".
user-invocable: false
---

# good-design-kiss

KISS means the smallest design that does the task the user gave today. Every abstraction, option, code branch, and layer must pay for itself with a user that exists now. This skill owns "is this part needed now". `good-design-dry` owns "does this exist already". `good-design-solid` owns how responsibilities split between types.

## Steps

1. **Argue every branch and every type.** The goal is linear code with no `if`. For each new `if`, `switch`, ternary, guard, or lookup on a kind, and for each new type, name the input that needs it. Then say why straight-line code or an existing type cannot do the job. Two or more fixed values are not such an input: put them in a table row or a field, and read them in straight-line code. Remove each branch and type with no such input. An error return is not a branch here. Done when the `unargued-branch-or-type` check passes.
2. **Add no part for a later need.** Add no option, flag, parameter, config key, type parameter, interface, or extension point that the task does not use now. "Later", "in case", and "so we can swap" name no user. Done when the `option-with-one-value` check passes.
3. **Add an abstraction only for two users.** An interface, a wrapper, or a base type needs two implementations or two callers today. A test fake that a test in this change uses counts as an implementation. A port at an external system counts only with a second adapter or such a fake; with one adapter and no fake, call the system directly. Done when the `abstraction-with-one-user` check passes.
4. **Copy the local pattern.** A new instance copies the constructor shape, the method set, and the file layout of the instances that exist. When the user says "do X like Y", copy Y from the real code, not a better variant of it, even when Y breaks a rule of these skills. Then report that breach and its fix to the user. Done when the `foreign-pattern` check passes.
5. **Write straight-line code.** Return an error early. Keep nesting at three levels or less. Do not write a clever form when a plain loop does the job. Use the standard library before a new dependency. Done when the `deep-nesting` and `dependency-for-a-small-job` checks pass.
6. **In a doc, show the direct flow.** A code sketch in a spec shows the calls that run, not a framework around them. Done when the `framework-in-sketch` check passes.
7. **Verify blind.** After the last edit, follow `## For the caller` in `~/.claude/agents/good-design-verifier.md`, once per change for all three good-design skills. Done when the verifier returns PASS or each finding is fixed or answered.

## Checks

| Slug | Check | Evidence of a breach |
|---|---|---|
| `unargued-branch-or-type` | For each new branch (not an error return) and each new type, name the input that needs it, and why straight-line code or an existing type cannot do the job. | A branch or a type with no such input, or one that a real input never takes. |
| `option-with-one-value` | For each new parameter, option, flag, and config key, list the values the callers pass. | One value everywhere, or no caller. |
| `abstraction-with-one-user` | For each new interface, wrapper, base type, and type parameter, count the implementations, the test fakes in use, and the callers (`rg -n '<Name>'`). | One implementation and no fake in use, or one caller. |
| `foreign-pattern` | Compare the new instance with two neighbors of the same kind. | A different constructor shape, method set, or layout with no reason in the task. |
| `deep-nesting` | Read the nesting depth of each new function. | Four or more levels. |
| `dependency-for-a-small-job` | For each new dependency, name the job and its size by hand. | A job of fewer than about 50 lines, or a job the standard library does. |
| `framework-in-sketch` | Read each code block of a doc. | A name that the block declares but never calls. |

A finding is not a breach when the task names the second user or the second value. Quote the task sentence in the reply.
