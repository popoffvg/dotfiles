---
name: critic
description: Build the strongest case AGAINST a decision that already looks right — up to three opus critics run in sequence, each one MUST find an attack the earlier ones missed, and every attack is settled with evidence. Trigger on "criticize this", "argue against it", "why is this wrong", "poke holes", "red team this", "what am I missing", "devil's advocate", "stress-test the decision", or before you commit to a hard-to-reverse choice, as a second opinion.
argument-hint: [the decision to attack]
---

# critic — the case against the decision

The decision arrives already defended: its owner has the reasons and the happy path. This skill supplies the other side. The method lives in the `critic` agent; this skill runs it up to three times and merges the result.

One critic stops at the attacks it finds first. Each later round reads the earlier reports and MUST find an attack they missed, so the rounds together cover more of the field than one long round.

## Flow

1. **Fix the decision.** Write the decision in one or two sentences. List the files, links, and conversation facts it rests on. If the decision is unclear, ask the user before you spawn anything. Pick a report dir: `<scratchpad>/critic-<slug>/`.
2. **Run the critic loop.** Start with `N = 1` and an empty `prior` list.

   ```
   loop:
     spawn a fresh `critic` agent:
       decision: <step 1>
       round:    N
       prior:    <every report path in the prior list>
       report:   <dir>/round-N.md
     wait for it to finish
     append <dir>/round-N.md to prior
     if round N has no NEW attack with verdict SURVIVES: stop
     if N = 3: stop
     N = N + 1
   ```

   The rounds run in sequence, never in parallel: each round needs the earlier reports to know what is not new.
3. **Grill the owner.** Collect the **Ask the owner** questions from the reports. Drop each question that the evidence in a later round already answers. Ask the rest through the `grilling` skill. Mark each attack its answer settles.
4. **Rule.** Merge the round reports into one. Rank the surviving attacks by damage, not by how clever they are. If nothing survived the evidence, say the decision holds. A critic that never clears a decision is not read next time.

## Rules

1. **Fresh agent per round.** Do not continue an earlier round with SendMessage. A round that remembers its own reasoning repeats it.
2. **Do not filter the rounds.** Carry every attack, the killed ones too, into the merged report. The killed attacks prove that the surviving ones are not cheap.
3. **Cost the alternative.** "This is wrong" is not actionable without the cost of the other way. If there is no alternative, say the decision may be the least-bad option.
4. **Rule, don't rewrite.** Output the case; the owner decides. Implementing the alternative is a separate request.

## Report

```markdown
# Critic: <the decision>

## Steelman
<the decision at its strongest, in its owner's terms>

**The bet** — this is right only if:
- B1 <must-be-true>
- B2 <must-be-true>

## Attacks
| # | Attack | Breaks | Round | Origin | Evidence | Verdict |
|---|--------|:------:|:-----:|--------|----------|---------|
| A1 | <claim> | B2 | 1 | border:extremes | `src/x.rs:88` — <what was observed> | SURVIVES |
| A2 | <claim> | B1 | 3 | unknown-unknown:who-is-absent | grill Q3: owner confirmed <> | SURVIVES |
| A3 | <claim> | B1 | 2 | in-frame | positive control found the caller — claim false | KILLED |

## What each round added
- Round 2: <the attacks round 1 missed — or: not run, round 1 found nothing new>
- Round 3: <the attacks rounds 1–2 missed — or: not run, round <N> found nothing new>

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

- `grilling` — the interview mechanics for step 3; `to-user` for the file shape of the questions.
- `hunch` — when the output is "the decision is wrong and we have no replacement", start a hunch from it.
- `thought` — record the surviving argument as a decision note if it changes the decision.
