# Triage a session transcript for interest

Read the human prompts of one session and classify them into one scope: **global**, **project**, or **neither**. Decide nothing else — no recurrence judgment, no candidate write-up, no skill. The lesson itself is extracted later, in batch, in [[dream]]'s harvest step.

Inputs, both given in the prompt: the transcript path, and the `<since-line>` to start from. The Stop hook only asks for triage on a session that is not archived yet — an archived session is re-synced by the hook itself with no model call, so never archive a second time and never re-judge a scope.

## Procedure

1. Extract the human-typed prompts:

   ```
   <plugin-root>/scripts/human-turns.sh <transcript> <since-line>
   ```

   Use the `<since-line>` from the prompt; it is `0` on the first pass. The transcript is mostly tool traffic and can be several megabytes — never read the raw file whole. The script prints only the prompts the person typed after `<since-line>`, each with its transcript line number.

   Nothing printed means nothing new to judge: return `SKIP`.

2. Classify the newly-printed prompts against the table below, in order. The first row that matches one prompt decides the whole pass.

   | The user's prompt | Scope | Why the split |
   |---|---|---|
   | Says an action, claim, or approach was wrong, or names a rule to follow instead — and the rule holds away from these files, this layout, this repo's tooling | `global` | it corrects behaviour, so it transfers |
   | States how work is done **here** — the order, the tool, the convention, the path this repo expects | `project` | it is true of the repos in context, not everywhere |
   | Plain request, follow-up question, approval, or a choice made for this task only | `neither` | nothing to keep |

   Stop at the verdict. Do not read the surrounding context, do not write out what the assistant did, do not judge whether the lesson recurs — that is dream's job, done once per batch instead of once per session.

3. On `neither`, return `SKIP` and archive nothing. The hook has already recorded the prompts as checked, so they are not re-judged.

   On `global` or `project`, archive the transcript under that scope:

   ```
   <plugin-root>/scripts/archive-transcript.sh <transcript> <global|project>
   ```

   That one command names the file from the session's own `ai-title` and writes `<archived-transcript>.env.md` beside the copy: the session's topic and one row per git repo that was in context, with branch and origin remote. Everything comes out of the transcript, so collect nothing about the environment yourself — no `pwd`, no `git` calls, no guessing from file paths.

## Output

Return `SKIP` alone when the pass found nothing to keep. Nothing else — no summary, no preamble.

Otherwise return `CATCHED <archived-transcript-path>` alone — the path the archive command printed. Nothing else.
