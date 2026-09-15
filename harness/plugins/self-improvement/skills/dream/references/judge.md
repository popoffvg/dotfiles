# Judge a harvested correction

The scan's 0–10 score says "this transcript looks interesting" — nothing more. It read the human prompts alone, with no tool calls, no assistant turns, and no repo. The harvest judge reads all of that. It answers two questions per correction, in order: **is it a lesson**, and **what is it worth**.

Run this per correction, not per transcript. One transcript can hold two lessons, or none.

## Gate 1 — is it a lesson

All four must hold. One failure drops the correction.

| Test | Holds when | Fails when |
|---|---|---|
| **Transfers** | the rule survives without the files it was said about | it names a value, a column, a branch that existed only that day |
| **Recurs** | you can name a future session where it fires again | the trigger is one migration, one incident, one ad-hoc script |
| **Corrects** | the assistant did something, and the human said do it differently | the human stated a preference the assistant never got wrong |
| **Actionable** | a reader can obey it without further judgment | it reads as taste — "be more careful", "think harder" |

**Read what the assistant actually did before judging.** The prompt is the complaint; the tool calls are the defect. A correction whose defect you never found in the transcript is not judged — it is dropped, and the block says the defect was not locatable.

## Gate 2 — already covered

Open the skill the suggestion names and read the body. A rule already written is not a lesson; it is a trigger that failed to fire. Then the block is not `new-skill` — it is a `description` rewrite against this session, which is a different and usually cheaper suggestion.

Check the health rollup for that skill too: `UNTRIGGERED` on the covering skill turns a "covered" verdict into a live defect worth a block of its own.

## Scoring

Then score `impact` and `effort` 1–5 each — the definitions are in `SKILL.md` § Fast-win score. Three anchors specific to harvest:

- **A correction the human repeated inside one session is impact 4 at minimum.** Repeating it is the human paying the cost twice; the scan's 9–10 band is that signal and it is the one band worth trusting.
- **An `extend` on an existing skill is effort 1–2.** A new skill dir with a trigger nobody has tested is effort 3 and up — the trigger is the hard part, not the body.
- **Impact is per-session frequency, not severity.** A rule that saves one turn in half the sessions beats a rule that saves an hour once a year.

## What the block must carry

Beyond the [[to-user]] four fields, a harvest block names:

- the **verdict** (`new-skill`, `extend`, `description-rewrite`, `doc`) and the target path,
- the scan's verdict where it differs, and the one line on why it is overruled,
- the **defect** — what the assistant did, in one clause, not what the human said,
- the repo rows from the `.env.md` sidecar, because they carry the scope choice.
