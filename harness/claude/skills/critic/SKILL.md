---
name: critic
description: Build the strongest case AGAINST a decision that already looks right — hunt the unknown unknowns, walk to the border of the field where the decision stops holding, grill the owner for what only they know, and settle every attack with evidence. Trigger on "criticize this", "argue against it", "why is this wrong", "poke holes", "red team this", "what am I missing", "devil's advocate", "stress-test the decision", or before committing to a hard-to-reverse choice.
argument-hint: [the decision to attack]
model-invocation: false
user-invocation: true
---

# critic — the case against the decision

The decision arrives already defended: its owner has the reasons, the happy path, and the sunk thought. This skill supplies the other side. Your job is **not** balance — it is to produce the single strongest argument the decision fails, and to back it with evidence a reasonable owner would accept.

Two failure modes bound the work:

- **Cheap criticism** — attacks that sound sharp and cite nothing. Every attack here dies or survives on evidence.
- **In-frame criticism** — attacks that accept the decision's own frame, so they can only find bugs inside it, never the reason the frame is wrong. Steps 2 and 3 exist to leave the frame.

You attack the decision, never the person who made it.

## Flow

1. **Steelman it first.** Restate the decision as its owner would at their sharpest: what it claims, what it buys, why the obvious objections already lose. Then write the **bet** underneath it — the list of things that must be true for it to be right. An attack that hits nothing on this list is noise; an attack on a line of this list is the whole game.
2. **Hunt unknown unknowns.** Known risks are already priced in. Ask what *class* of fact this decision is structurally unable to notice:
   - **Who is not in the room?** The consumer, the operator, the future maintainer, the failing region — whose evidence never reaches this table?
   - **What did we not measure because we never thought to?** Name the instrument that does not exist.
   - **What would we call a success even if it failed?** If the outcome and its opposite both look like "working", the decision is untestable and that is the finding.
   - **Where does the reasoning use a word nobody has defined?** Undefined words are where unknown unknowns hide.
   Turn each into a concrete thing to look for. An unknown unknown that stays abstract cannot be checked.
3. **Walk to the border of the field.** Every decision holds inside a range and breaks outside it. Find the outside:
   - **Extremes** — 100× the load, 1 user, zero data, everything concurrent, the network gone.
   - **Time** — right on day one, wrong in a year; what it costs to reverse after it sets.
   - **Adjacent discipline** — how would security / ops / a lawyer / a support engineer / a beginner describe this same decision? Borrow their vocabulary and re-read it.
   - **Prior art at the border** — who already tried this and what killed them. Find the neighbour who failed, not the one who succeeded.
   - **Invert** — assume it already failed in six months; write the post-mortem's first line, then work backwards to the cause.
4. **Grill for what only the owner knows.** Some attacks cannot be settled from the code or the docs — they turn on intent, constraint, or a fact only the human holds. Route those through the `grilling` skill: one file, one block per question, each carrying the attack it belongs to and a recommended answer. Do not ask the human anything the codebase can answer.
5. **Collect evidence, attack by attack.** Each attack is a claim to be tested, not stated. Read the code, run the command, read the doc, check the history. Record what you actually observed, with `file:line`, command output, or a citation — never a paraphrase from memory.
   - **A negative finding needs a positive control.** "No caller does this" is worthless until the same query finds a caller you know exists. A query that cannot see anything answers exactly like a query about something gone.
   - Evidence that *supports* the decision is recorded too, on the same table. Attacks you killed yourself are the reason the surviving ones are credible.
6. **Rule.** Rank the surviving attacks by damage, not by how clever they are. Deliver the **one** strongest argument against, the attacks that died and what killed them, the **kill criterion** (the observation that would settle it either way), and the cheapest probe that produces it. If nothing survived evidence, say the decision holds — a critic who never clears anything is not being read next time.

## Rules

1. **Evidence or withdraw.** An attack with no evidence column is deleted before the report, not shipped as a "concern".
2. **Attack the bet, not the wording.** Every finding must name the line of step 1's bet it breaks. Style, taste, and naming belong to other skills.
3. **Steelman before you swing.** If your restatement is one the owner would not sign, you are attacking a decision nobody made.
4. **Leave the frame at least once.** At minimum one attack must come from step 2 or 3 — outside the decision's own terms. Otherwise this is a code review.
5. **A killed attack is reported.** What you tried and could not make stick is the proof the surviving attacks are not cheap.
6. **Name the kill criterion.** An argument nobody can settle by observation is a preference. Say what would change your mind, and what would change theirs.
7. **Cost the alternative.** "This is wrong" without what it costs to do otherwise is not actionable. If you have no alternative, say the decision may be the least-bad and attack it anyway.
8. **Rule, don't rewrite.** Output the case; the owner decides. Implementing the alternative is a separate ask.

## Report

```markdown
# Critic: <the decision>

## Steelman
<the decision at its strongest, in its owner's terms>

**The bet** — this is right only if:
- B1 <must-be-true>
- B2 <must-be-true>

## Attacks
| # | Attack | Breaks | Origin | Evidence | Verdict |
|---|--------|:------:|--------|----------|---------|
| A1 | <claim> | B2 | border:extremes | `src/x.rs:88` — <what was observed> | SURVIVES |
| A2 | <claim> | B1 | unknown-unknown:who-is-absent | grill Q3: owner confirmed <> | SURVIVES |
| A3 | <claim> | B1 | in-frame | positive control found the caller — claim false | KILLED |

## The strongest argument against
<one paragraph — the attack that does the most damage, and the damage>

## Kill criterion
<the observation that settles it> — cheapest probe: <what to run/read/ask, and its cost>

## Alternative and its cost
<what to do instead, what it costs — or: none found, and why the decision may still be least-bad>

## Left open
<what neither evidence nor the grill could settle>
```

## Related

- `grilling` — the interview mechanics for step 4; `to-user` for the answerable-block file shape.
- `hunch` — when the output is "the decision is wrong and we have no replacement", that is a hunch's starting mess.
- `thought` — record the surviving argument as a decision note if it changes the decision.
