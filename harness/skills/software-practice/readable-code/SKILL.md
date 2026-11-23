---
name: readable-code
description: Rules that make code read once, top to bottom, without a jump back — file order, control flow, signatures, locality, error text, and test shape. Use when writing or changing code in any language, when writing a test, and when the user says "readable", "hard to follow", "clean this up for the reader", or "make it easier to review". Names belong to `searchable-names`; nesting depth and early returns belong to `good-design-kiss`.
---

# readable-code

The reader reads the code once, from the top, and must not jump back. Each rule below has a slug. The same slug is a rule in the personal `reviewrules` set (`~/git/dotfiles/harness/reviewrules-personal/.reviewrules/config.json`), so a review finding names the rule here.

## Steps

1. Before you write a function, decide where it goes in the file: apply `top-down-file-order`.
2. Write the body with the main path last and flat: apply `happy-path-left`, `one-abstraction-level`, `no-clever-expressions`, and `declare-near-use`.
3. Check every new signature: apply `no-bool-params`, `positive-predicates`, `types-at-boundaries`, and `no-action-at-distance`.
4. Check every new error and log text: apply `error-says-operation`.
5. Check every new test: apply `test-name-is-sentence` and `test-reads-given-when-then`.

Done when each new or changed function passes every row of the table below.

## Rules

| Slug | Rule | Breach |
|---|---|---|
| `top-down-file-order` | The main type and the public entry point come first. A helper comes below its first caller. Private types come last. | A helper above the function that calls it; the entry point at the end of the file. |
| `happy-path-left` | Handle each error and edge case first and return. The main path ends the function at the left margin. | The main path inside an `else` or inside the `if` of a success check. |
| `one-abstraction-level` | One function calls steps of one level. A function longer than one screen (about 40 lines) is a signal to check this rule. | Domain calls (`loadSnapshot`) next to a byte loop or string slicing in the same body. |
| `no-clever-expressions` | Give each step with a domain meaning its own named variable. | A nested ternary, a side effect inside a condition, a chain of more than three calls with no name for the result. |
| `declare-near-use` | Declare a variable just before its first use, in the smallest scope. | A variable declared at the top and first read 20 lines later, or outside the block that uses it. |
| `no-bool-params` | A public function takes no bare `bool` that changes what it does. Use a named type, an enum, or two functions. | A call site such as `save(doc, true)`. |
| `positive-predicates` | Name a boolean as a positive fact. | `notDisabled`, `skipNoCheck`, `!isNotReady`. |
| `types-at-boundaries` | Write the type of every public function and every exported value, also where the language infers it. | An exported TS function with no return type; a Python public function with no annotations. |
| `no-action-at-distance` | A function does not change its arguments or global state. It returns the new value. | A helper that appends to a slice or map it got as an argument and returns nothing. |
| `error-says-operation` | Wrap each returned error with the operation and its key input. | `return err` across a package boundary; `failed: %w` with no operation and no input. |
| `test-name-is-sentence` | A test name says the behavior it proves. | `TestRestore2`, `test_case_ok`. |
| `test-reads-given-when-then` | A test body has three blocks: setup, one action, checks. | Two actions in one test; a check between two actions. |

## Examples

```go
// no-bool-params
save(doc, true)                 // breach
save(doc, saveMode.Overwrite)   // fix

// happy-path-left
if err == nil { return use(v) } ; return err   // breach
if err != nil { return err } ; return use(v)   // fix

// error-says-operation
return err                                        // breach
return fmt.Errorf("load snapshot %s: %w", id, err) // fix
```
