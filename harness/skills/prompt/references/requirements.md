# Goal prompt parts

## Questions per part

A reader fills each gap with a guess, and the user sees the guess only in the result. Ask each question the use case touches, and push the answer until it passes the part's test.

| Part | Test it MUST pass | Questions |
|---|---|---|
| Result | Two readers name the same deliverable. | Who uses the result, and what do they do with it next? Is it one piece or several? Where does it live? |
| Cause | It names the problem or decision the result serves, and a near result it rejects. | What goes wrong today without it? Which decision does it make faster or safer? Why not the obvious alternative? |
| Properties | Each one is observable in the result: a number, a rule, or a sample, never "clean" or "good". | Which existing thing must it look like? What starts it, and what must happen before and after? |
| Checks | Each property has a pass/fail check on the result. | What do you compare it against, and who or what judges it? |
| Limits | Each one names a visible boundary and its reason. | What must not change? Which existing material must it reuse? This one case, or the rule behind it? What budget in time, words, or cost? What does the reader do alone, and what does it ask first? |

## Skeleton

```
<goal>Verb + result, in one sentence.</goal>
<cause>The problem or decision it serves; the near result it rejects, and why.</cause>
<result>What exists at the end, where it lives, its shape — a filled-in sample when the shape matters.</result>
<properties>
- One observable property per line.
</properties>
<checks>
- One pass/fail check per line: command → expected output, input → output, or a yes/no question.
</checks>
<limits>
- Out of scope: … — reason.
- Do not change: … — reason.
- When blocked or unclear: stop and ask | state the assumption and go on.
</limits>
<input>The data for this run, when the reader needs it.</input>
```

Keep tag names the same across prompts.
