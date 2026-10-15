# Goal prompt requirements

## The five parts

| Part | What it says | Test it MUST pass |
|---|---|---|
| Mission | The decision or the use the result serves: who acts on it and what they decide. | Given two valid results, the mission picks one. A reason the receiver must guess is a missing mission. |
| Result | The one thing that exists or is true at the end: one verb, one object. | Two readers name the same deliverable. "Suggest changes" and "change the text" are different results. |
| Properties | What is true of the result. | Each property is observable in the result. "Clean", "fast", "good" become a number, a rule, or a sample. |
| Acceptance criteria | Pass/fail checks: an input and its expected output, a measure against a baseline, a question a reviewer answers yes or no. | Every property has at least one check. A check tests the result, not the path to it. |
| Limits | Where the work stops. Each limit with its reason. | A limit names a boundary a reader can see. |

## Where goals break

A receiver fills each gap below with a guess, and the user corrects the guess only after seeing the result. Ask each gap the use case touches. Push the answer until it passes its part's test.

| Part | Gap | Question |
|---|---|---|
| Mission | Decision served | Which decision does the result feed, and what does the reader do next with it? |
| Result | Unit | Is it one piece or several? Where does one end and the next start? |
| Result | Place | Where does the result live, and which part of the whole owns it? |
| Properties | Model to copy | Which existing thing must it look like? Show one you like. |
| Properties | Order and trigger | What starts it, and what must happen before and after it? |
| Acceptance | Baseline | What do you compare it against, and who or what judges it? |
| Limits | Must not change | What stays exactly as it is now, including the meaning? |
| Limits | Use what exists | Which existing material, tool, or text must it reuse instead of making new? |
| Limits | Reach | Is this about this one case, or about the rule that produced it? |
| Limits | Size of change | A small edit or a redesign? What is the budget in time, words, or cost? |
| Limits | Who does what | What does the receiver do alone, what does it ask about first, and what do you keep for yourself? |

## Anti-patterns

- A goal with no mission: the receiver guesses the reason and picks the wrong trade-off when the prompt is silent.
- A vague verb: "help with", "look at", "improve", "handle".
- Steps, tool choices, or an order of work the receiver can pick itself.
- A property with no acceptance check.
- A check that repeats a property word for word instead of saying how to test it.
- A check on the path ("run the linter first") instead of on the result.
- A ban with no positive target, or a limit with no reason.
- Shouting: ALL CAPS, "CRITICAL", "You MUST ALWAYS".
- Facts the receiver already has or can read itself: its files, its rules, the conversation. Point to the source at most.
- A sentence that changes no behaviour.
- A metaphor where a literal phrase says the same.

## Skeleton

```
<goal>Verb + result, in one sentence.</goal>
<mission>The decision or the use the result serves, in one sentence.</mission>
<result>What exists at the end, where it lives, its shape — a filled-in sample when the shape matters.</result>
<properties>
- One observable property per line.
</properties>
<acceptance>
- One pass/fail check per line: command → expected output, input → output, or a yes/no question.
</acceptance>
<limits>
- In scope: …
- Out of scope: … — reason.
- Do not change: … — reason.
- When blocked or unclear: stop and ask | state the assumption and go on.
</limits>
<input>The data for this run, when the receiver needs it.</input>
```

Long input goes below the goal sections. Keep tag names the same across prompts.
