---
name: search-the-prompt-before-the-judge
description: Search — make an eval score higher by changing the prompt. Keep the model and the score rules the same. Use this when the user says "improve the eval score", "change the prompt, not the model", or "search prompt variants".
user-invocable: false
---

# search-the-prompt-before-the-judge

Keep the model the same. Keep the score rules the same. Change the prompt.

`skill-blank` writes one new prompt. This skill repeats that step.

A **copy** is the full prompt with one change. Do not edit the prompt in the project during the search. Write it there only after the judge accepts a winner.

## Flow

The flow is one step of `skill-blank`.

The input is the best copy, the list of misses, and one example that shows the low score.

The output is one row of counts for each run.

Use one example until the judge runs. Run the full set of examples only on the winner.

## Keep these the same

Use the same model. Use the same thinking level. Use the same judge.

An empty result means the run failed. Check the time limit before you change the prompt.

Do not change the score rules. Do not change the expected answers.

If the checker and the judge disagree, the checker is wrong. Fix the checker.

## What you keep between rounds

- **Best copy.** The copy with the best counts. Start from the prompt in the project. Put this copy outside the folder that loads that prompt.
- **Misses.** The problems the judge already named. Write each problem as a missing part. Start from the latest judge notes.
- **Useful counts.** Counts that are near zero on a good result and high on a bad result. You learn these counts when you test the checker.
- **Rounds.** The number of copies since the last judge run. Start at 0. Add 1 after each copy.

## When you stop

- **Done.** This is the main stop. The best copy matches the good result on the useful counts. The judge raises the score part that was low.
- **No change.** Two rounds pass, and no copy beats the best copy on those counts.
- **Six rounds.** Then run the judge once on the best copy.
- **User.** The user says stop.

## One round

Read the best copy and the list of misses. Make one new copy with one `skill-blank` step. Run that copy in a folder that loads only that copy. Run it three or four times at the same time. Do not use the judge.

Keep the new copy when a useful count is better, and the copy still has every part of the good result. This copy becomes the best copy.

When the judge finds a new miss, add that miss to the list as a missing part. Then check the stop rules.

Test the checker before the first copy. The checker counts the misses. It finishes in less than one second. It is not a second set of score rules.

Trust a count only when the good result is clean and a bad result shows the miss the judge named. Remove a count that marks the good result. Remove a count that misses the bad result. Add a count when the judge names a miss the checker cannot see. Take the counts from this judge. Do not reuse counts from a different prompt.

Run the judge only on the best copy, and only when you stop. Run it three times on the same example. Read the score part that was low. A lower total is still a success when that score part stays up. Add new misses to the list.
