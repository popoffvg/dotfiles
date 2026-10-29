---
name: and-what
description: "and-what: play out what happens if we do NOT follow an agent's advice — a review finding, a proposed fix, an extra check or retry — and weigh that against what the advice costs. Use on `/and-what`, \"and what if we skip it\", \"what happens if we ignore this\", \"is this finding worth it\", or before you accept a fix that adds code for a rare case."
---

# and-what — the world where we skip the advice

An agent's advice always sounds safe, because it names only the harm of skipping it. This skill writes the other half: the concrete world where we skip it, and the price of following it. Then the operator decides on both. Apply every step to each piece of advice the operator names; with no name, take the last advice in the conversation.

Write every sentence for the operator, in the words of the product. Read-only: never apply the advice and never edit code.

## Steps

1. **Name the advice.** One line: what it adds, removes, or changes, and its source (a report path and line, a `file:line`, a message). Done when the line exists.
2. **Find the trigger.** Write the input and the state that make the skipped case happen, from the advice's own scenario or from the code. Prove that the code can reach it with a `file:line`. A claim that it cannot happen needs a positive control: the same search against a case that exists. Done when the trigger is proven reachable or proven unreachable.
3. **Say how often.** Name each condition that must hold together, for example "a lost reply, then 20 s of storage failures". Use a measured rate when one exists, with its source. Without one, label the rate `assumption` and state its basis. Done when every condition is listed.
4. **Play out the skip.** Pick the impact and write what the application or its user sees, who notices it, and how it recovers:

   | Impact | The application or its user sees |
   |---|---|
   | `data` | wrong, lost, or overwritten data; two writers where one is allowed |
   | `outage` | the feature stops working until a human acts |
   | `retry` | one call fails, and a retry of the same call works |
   | `delay` | the call works, but later |
   | `message` | only an error text or a log line is wrong or less exact |
   | `none` | nothing: the case cannot be reached, or another mechanism already covers it (name it with its `file:line`) |

   Done when the impact, the visible result, and the recovery are written.
5. **Price the advice.** Count what following it adds or removes: lines, branches, error kinds, states, tests, and the ADR Properties it adds or tightens. Name what it makes harder later, for example "every new caller must handle a third error". Done when each count is a number.
6. **Give the verdict.**

   | Verdict | When |
   |---|---|
   | follow | the impact is `data` or `outage`, or the advice removes code |
   | skip | the impact is `retry`, `delay`, `message`, or `none`, and the advice adds code |
   | ask | the trigger or the rate cannot be decided from the evidence |

   A skip names where the accepted risk is written down: an ADR Consequence, a `## Deviations` row, or a test name that documents the behavior. Done when the verdict and that place exist.

## Output

```
### and-what: <the advice, one line>
Source: <path:line or message>
Trigger: <input and state> — reachable: <file:line> | unreachable: <file:line + positive control>
How often: <conditions together> — <rate + source | assumption: basis>
If we skip it: <impact> — <what the application or its user sees> — recovers by <retry | restart | a human | itself>
Cost of following: <+/-N lines, +/-N branches, +/-N error kinds, +/-N tests, Properties>
Verdict: follow | skip | ask — <one sentence why>
Risk written to: <ADR Consequence | Deviations row | test name>   (skip only)
```

One block per piece of advice. Put the blocks with verdict `follow` or `ask` first.
